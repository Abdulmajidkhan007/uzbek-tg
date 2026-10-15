/**
 * Biriktirish paneli (Telegram Android uslubi): pastdan chiqadigan varaq.
 *  - Galereya: so'nggi rasm/videolar 3 ustunli to'rda (AppNative.getRecentMedia),
 *    birinchi katak — kamera; tanlanganda tartib raqami, pastda izoh + yuborish.
 *  - Fayl: tizim fayl tanlagichi (AppNative.pickDocument).
 *  - Joylashuv: joriy koordinatalar (AppNative.getCurrentLocation) → yuborish.
 *  - Kontakt: Telegram kontaktlari ro'yxati, qidiruv → yuborish.
 *
 * Modal emas, chat ekrani ichidagi qatlam: klaviatura balandligi (izoh yozganda)
 * shu oynada to'g'ri olinadi.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  BackHandler,
  PanResponder,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import * as Haptics from '@/utils/haptics';
import { useTheme } from '@/hooks/useTheme';
import { useT, t } from '@/i18n';
import { AppNative, type GalleryItem } from '@/services/native';
import { loadContacts, type OutgoingMedia } from '@/services/tdlib/chats';
import type { UserPreview } from '@/stores/chat.store';
import Avatar from '@/components/common/Avatar';
import { showAlert } from '@/components/ui/Dialog';

export interface AttachSheetProps {
  /** Asosiy yozish maydonidagi matn — izoh sifatida taklif qilinadi. */
  initialCaption: string;
  /** useAnimatedKeyboard().height (dp, navigatsiya paneli bilan birga). */
  keyboardHeight: SharedValue<number>;
  onClose: () => void;
  /** Rasm/video/fayl yuborish; izoh bo'sh bo'lmasa — birinchi elementga. */
  onSendMedia: (items: OutgoingMedia[], caption: string) => Promise<void>;
  onSendLocation: (loc: { latitude: number; longitude: number; accuracy: number }) => Promise<void>;
  onSendContact: (userId: string) => Promise<void>;
}

type Tab = 'gallery' | 'location' | 'contact';

const MAX_SELECTED = 10;
const GAP = 2;
const CAMERA_ITEM = '__camera__';

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function durationLabel(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function assetToMedia(a: Asset): OutgoingMedia | null {
  if (!a.uri) return null;
  const isVideo = (a.type ?? '').startsWith('video');
  return {
    kind: isVideo ? 'video' : a.type === 'image/gif' ? 'document' : 'photo',
    path: a.uri.replace(/^file:\/\//, ''),
    width: a.width,
    height: a.height,
    duration: a.duration,
  };
}

// ---------------------------------------------------------------------------
// Galereya katagi
// ---------------------------------------------------------------------------
const GalleryTile = React.memo(function GalleryTile({
  item,
  size,
  order,
  last,
  onToggle,
}: {
  item: GalleryItem;
  size: number;
  /** Qatordagi oxirgi (3-) katak — o'ng oraliqsiz. */
  last: boolean;
  /** 0 — tanlanmagan, aks holda tartib raqami (1..). */
  order: number;
  onToggle: (item: GalleryItem) => void;
}) {
  const theme = useTheme();
  const selected = order > 0;
  return (
    <Pressable
      onPress={() => onToggle(item)}
      style={{ width: size, height: size, marginRight: last ? 0 : GAP, marginBottom: GAP, backgroundColor: theme.colors.surfaceHighlight }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <Image
        source={{ uri: item.uri }}
        style={[StyleSheet.absoluteFill, selected && styles.tileImageSelected]}
        resizeMode="cover"
        resizeMethod="resize"
      />
      {item.isVideo ? (
        <View style={styles.durationBadge}>
          <Ionicons name="videocam" size={11} color="#FFFFFF" />
          <Text style={styles.durationText}>{durationLabel(item.duration)}</Text>
        </View>
      ) : null}
      <View
        style={[
          styles.tileCircle,
          selected ? { backgroundColor: theme.colors.primary, borderColor: '#FFFFFF' } : styles.tileCircleOff,
        ]}
      >
        {selected ? <Text style={styles.tileCircleText}>{order}</Text> : null}
      </View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Asosiy komponent
// ---------------------------------------------------------------------------
export default function AttachSheet({
  initialCaption,
  keyboardHeight,
  onClose,
  onSendMedia,
  onSendLocation,
  onSendContact,
}: AttachSheetProps): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const tr = useT();
  const insets = useSafeAreaInsets();
  const { width, height: winHeight } = useWindowDimensions();

  const [tab, setTab] = useState<Tab>('gallery');
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState(initialCaption);
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- balandlik: ~60% (yig'iq) yoki deyarli to'liq ekran (yoyiq)
  const collapsedH = Math.round(winHeight * 0.62);
  const expandedH = Math.round(winHeight - insets.top - 8);
  const [expanded, setExpanded] = useState(false);
  const sheetH = useSharedValue(collapsedH);
  const dragY = useSharedValue(0);
  useEffect(() => {
    sheetH.value = withTiming(expanded ? expandedH : collapsedH, { duration: 220 });
  }, [expanded, expandedH, collapsedH, sheetH]);

  const bottomInset = useSharedValue(insets.bottom);
  useEffect(() => {
    bottomInset.value = insets.bottom;
  }, [insets.bottom, bottomInset]);

  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetH.value,
    paddingBottom: Math.max(keyboardHeight.value, bottomInset.value),
    transform: [{ translateY: dragY.value }],
  }));

  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  // Android "orqaga" — panelni yopadi.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  const showHint = useCallback((s: string) => {
    setHint(s);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 2000);
  }, []);

  // Tutqichni tortish: yuqoriga — yoyish, pastga — yig'ish / yopish.
  const state = useRef({ expanded, close });
  state.current = { expanded, close };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_e, g) => {
        dragY.value = Math.max(0, g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        dragY.value = withTiming(0, { duration: 150 });
        if (g.dy < -30) setExpanded(true);
        else if (g.dy > 70) {
          if (state.current.expanded) setExpanded(false);
          else state.current.close();
        }
      },
      onPanResponderTerminate: () => {
        dragY.value = withTiming(0, { duration: 150 });
      },
    }),
  ).current;

  // -------------------------------------------------------------------------
  // Galereya
  // -------------------------------------------------------------------------
  const [perm, setPerm] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [media, setMedia] = useState<GalleryItem[] | null>(null);
  const [selected, setSelected] = useState<GalleryItem[]>([]);

  const loadMedia = useCallback(() => {
    AppNative.getRecentMedia(90)
      .then((list) => setMedia(list))
      .catch((e: unknown) => {
        setMedia([]);
        showHint(errText(e));
      });
  }, [showHint]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const has = await AppNative.hasMediaPermission().catch(() => false);
      const ok = has || (await AppNative.requestMediaPermission().catch(() => false));
      if (!alive) return;
      setPerm(ok ? 'granted' : 'denied');
      if (ok) loadMedia();
    })();
    return () => {
      alive = false;
    };
  }, [loadMedia]);

  const requestAccess = useCallback(async () => {
    const ok = await AppNative.requestMediaPermission().catch(() => false);
    setPerm(ok ? 'granted' : 'denied');
    if (ok) loadMedia();
  }, [loadMedia]);

  const toggle = useCallback(
    (item: GalleryItem) => {
      setSelected((prev) => {
        if (prev.some((x) => x.id === item.id)) return prev.filter((x) => x.id !== item.id);
        if (prev.length >= MAX_SELECTED) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          showHint(t('chat.attach.limit', { n: MAX_SELECTED }));
          return prev;
        }
        return [...prev, item];
      });
      Haptics.selectionAsync();
    },
    [showHint],
  );

  const orderOf = useMemo(() => {
    const m = new Map<string, number>();
    selected.forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [selected]);

  const runSend = useCallback(
    async (fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      try {
        await fn();
        onClose();
      } catch (e) {
        showAlert(t('chat.sendError'), errText(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, onClose],
  );

  const sendSelected = useCallback(() => {
    if (selected.length === 0) return;
    void runSend(async () => {
      const items: OutgoingMedia[] = [];
      for (const g of selected) {
        const f = await AppNative.copyToCache(g.uri);
        const mime = g.mime || f.mime || '';
        items.push({
          kind: g.isVideo ? 'video' : mime === 'image/gif' ? 'document' : 'photo',
          path: f.path,
          width: g.width || undefined,
          height: g.height || undefined,
          duration: g.isVideo ? g.duration : undefined,
        });
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await onSendMedia(items, caption.trim());
    });
  }, [selected, caption, onSendMedia, runSend]);

  const openCamera = useCallback(() => {
    launchCamera({ mediaType: 'photo', saveToPhotos: false, quality: 0.9 })
      .then((res) => {
        if (res.didCancel) return;
        if (res.errorCode) {
          showAlert(t('chat.actionFailed'), res.errorMessage ?? res.errorCode);
          return;
        }
        const items = (res.assets ?? []).map(assetToMedia).filter((x): x is OutgoingMedia => x !== null);
        if (items.length) void runSend(() => onSendMedia(items, caption.trim()));
      })
      .catch((e: unknown) => showAlert(t('chat.actionFailed'), errText(e)));
  }, [caption, onSendMedia, runSend]);

  const openSystemGallery = useCallback(() => {
    launchImageLibrary({ mediaType: 'mixed', selectionLimit: MAX_SELECTED, quality: 1 })
      .then((res) => {
        if (res.didCancel) return;
        if (res.errorCode) {
          showAlert(t('chat.actionFailed'), res.errorMessage ?? res.errorCode);
          return;
        }
        const items = (res.assets ?? []).map(assetToMedia).filter((x): x is OutgoingMedia => x !== null);
        if (items.length) void runSend(() => onSendMedia(items, caption.trim()));
      })
      .catch((e: unknown) => showAlert(t('chat.actionFailed'), errText(e)));
  }, [caption, onSendMedia, runSend]);

  const pickFile = useCallback(() => {
    AppNative.pickDocument()
      .then((f) => {
        if (f) void runSend(() => onSendMedia([{ kind: 'document', path: f.path }], ''));
      })
      .catch((e: unknown) => showAlert(t('chat.actionFailed'), errText(e)));
  }, [onSendMedia, runSend]);

  const tile = Math.floor((width - GAP * 2) / 3);
  const gridData = useMemo<(GalleryItem | typeof CAMERA_ITEM)[]>(() => [CAMERA_ITEM, ...(media ?? [])], [media]);

  const onGridScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!expanded && e.nativeEvent.contentOffset.y > 24) setExpanded(true);
    },
    [expanded],
  );

  const renderGridItem = useCallback(
    ({ item, index }: { item: GalleryItem | typeof CAMERA_ITEM; index: number }) => {
      const last = index % 3 === 2;
      if (item === CAMERA_ITEM) {
        return (
          <Pressable
            onPress={openCamera}
            style={[styles.cameraTile, { width: tile, height: tile, marginRight: last ? 0 : GAP }]}
            accessibilityRole="button"
            accessibilityLabel={tr('chat.attach.camera')}
          >
            <Ionicons name="camera" size={34} color="#FFFFFF" />
          </Pressable>
        );
      }
      return <GalleryTile item={item} size={tile} last={last} order={orderOf.get(item.id) ?? 0} onToggle={toggle} />;
    },
    [openCamera, tile, orderOf, toggle, tr],
  );

  // -------------------------------------------------------------------------
  // Joylashuv
  // -------------------------------------------------------------------------
  const [loc, setLoc] = useState<
    | { state: 'idle' | 'loading' | 'denied' }
    | { state: 'error'; message: string }
    | { state: 'ready'; latitude: number; longitude: number; accuracy: number }
  >({ state: 'idle' });

  const fetchLocation = useCallback(async () => {
    setLoc({ state: 'loading' });
    const ok = await AppNative.requestLocationPermission().catch(() => false);
    if (!ok) {
      setLoc({ state: 'denied' });
      return;
    }
    try {
      const p = await AppNative.getCurrentLocation();
      setLoc({ state: 'ready', latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy });
    } catch (e) {
      setLoc({ state: 'error', message: errText(e) });
    }
  }, []);

  useEffect(() => {
    if (tab === 'location' && loc.state === 'idle') void fetchLocation();
  }, [tab, loc.state, fetchLocation]);

  // -------------------------------------------------------------------------
  // Kontaktlar
  // -------------------------------------------------------------------------
  const [contacts, setContacts] = useState<UserPreview[] | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (tab !== 'contact' || contacts) return;
    loadContacts()
      .then(setContacts)
      .catch((e: unknown) => {
        setContacts([]);
        setContactsError(errText(e));
      });
  }, [tab, contacts]);

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = contacts ?? [];
    if (!q) return list;
    return list.filter((u) =>
      `${u.firstName} ${u.lastName ?? ''} ${u.username ?? ''}`.toLowerCase().includes(q),
    );
  }, [contacts, query]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const title =
    tab === 'gallery'
      ? selected.length > 0
        ? tr.p('chat.selected', selected.length)
        : tr('chat.attach.gallery')
      : tab === 'location'
      ? tr('chat.attach.location')
      : tr('chat.attach.contact');

  const permissionCard = (
    <View style={styles.centerBox}>
      <Ionicons name="images-outline" size={52} color={c.textTertiary} />
      <Text style={[styles.cardTitle, { color: c.text }]}>{tr('chat.attach.permissionTitle')}</Text>
      <Text style={[styles.cardText, { color: c.textSecondary }]}>{tr('chat.attach.permissionText')}</Text>
      <Pressable onPress={() => void requestAccess()} style={[styles.primaryBtn, { backgroundColor: c.primary }]} accessibilityRole="button">
        <Text style={styles.primaryBtnText}>{tr('chat.attach.allowAccess')}</Text>
      </Pressable>
      <Pressable onPress={openSystemGallery} style={styles.linkBtn} accessibilityRole="button">
        <Text style={[styles.linkBtnText, { color: c.primary }]}>{tr('chat.attach.chooseFromGallery')}</Text>
      </Pressable>
      <Pressable onPress={openCamera} style={styles.linkBtn} accessibilityRole="button">
        <Text style={[styles.linkBtnText, { color: c.primary }]}>{tr('chat.attach.camera')}</Text>
      </Pressable>
    </View>
  );

  let body: React.ReactNode;
  if (tab === 'gallery') {
    if (perm === 'checking') body = <ActivityIndicator color={c.primary} style={styles.loader} />;
    else if (perm === 'denied') body = permissionCard;
    else
      body = (
        <FlatList
          data={gridData}
          numColumns={3}
          keyExtractor={(it) => (it === CAMERA_ITEM ? CAMERA_ITEM : it.id)}
          renderItem={renderGridItem}
          extraData={orderOf}
          onScroll={onGridScroll}
          scrollEventThrottle={32}
          initialNumToRender={18}
          windowSize={7}
          removeClippedSubviews
          ListFooterComponent={
            media === null ? (
              <ActivityIndicator color={c.primary} style={styles.loader} />
            ) : media.length === 0 ? (
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>{tr('chat.attach.noMedia')}</Text>
            ) : null
          }
        />
      );
  } else if (tab === 'location') {
    body = (
      <View style={styles.centerBox}>
        {loc.state === 'loading' || loc.state === 'idle' ? (
          <>
            <ActivityIndicator color={c.primary} size="large" />
            <Text style={[styles.cardText, { color: c.textSecondary }]}>{tr('chat.attach.locating')}</Text>
          </>
        ) : loc.state === 'denied' || loc.state === 'error' ? (
          <>
            <Ionicons name="location-outline" size={52} color={c.textTertiary} />
            <Text style={[styles.cardText, { color: c.textSecondary }]}>
              {loc.state === 'denied' ? tr('chat.attach.locationPermission') : `${tr('chat.attach.locationFailed')}\n${loc.message}`}
            </Text>
            <Pressable onPress={() => void fetchLocation()} style={[styles.primaryBtn, { backgroundColor: c.primary }]} accessibilityRole="button">
              <Text style={styles.primaryBtnText}>{tr('common.retry')}</Text>
            </Pressable>
          </>
        ) : (
          <View style={[styles.locCard, { backgroundColor: c.surfaceHighlight }]}>
            <View style={styles.locRow}>
              <View style={[styles.locIcon, { backgroundColor: c.primary }]}>
                <Ionicons name="location" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.locTitle, { color: c.text }]}>{tr('chat.attach.currentLocation')}</Text>
                <Text style={[styles.locCoords, { color: c.textSecondary }]} selectable>
                  {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                </Text>
                {loc.accuracy > 0 ? (
                  <Text style={[styles.locCoords, { color: c.textSecondary }]}>
                    {tr('chat.attach.accuracy', { n: Math.round(loc.accuracy) })}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => void fetchLocation()} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('common.retry')}>
                <Ionicons name="refresh" size={22} color={c.primary} />
              </Pressable>
            </View>
            <Pressable
              onPress={() =>
                void runSend(() => onSendLocation({ latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy }))
              }
              style={[styles.primaryBtn, styles.fullBtn, { backgroundColor: c.primary }]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>{tr('chat.attach.sendLocation')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  } else {
    body = (
      <View style={{ flex: 1 }}>
        <View style={[styles.searchBox, { backgroundColor: c.surfaceHighlight }]}>
          <Ionicons name="search" size={18} color={c.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tr('chat.attach.searchContacts')}
            placeholderTextColor={c.textTertiary}
            style={[styles.searchInput, { color: c.text }]}
          />
        </View>
        {contacts === null ? (
          <ActivityIndicator color={c.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={(u) => u.id}
            keyboardShouldPersistTaps="handled"
            onScroll={onGridScroll}
            scrollEventThrottle={32}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => void runSend(() => onSendContact(item.id))}
                android_ripple={{ color: c.surfaceHighlight }}
                style={styles.contactRow}
                accessibilityRole="button"
              >
                <Avatar uri={item.avatarUrl} name={item.firstName} size={44} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName, { color: c.text }]} numberOfLines={1}>
                    {`${item.firstName} ${item.lastName ?? ''}`.trim()}
                  </Text>
                  {item.username ? (
                    <Text style={[styles.contactSub, { color: c.textSecondary }]} numberOfLines={1}>
                      @{item.username}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {contactsError ?? tr('chat.attach.noContacts')}
              </Text>
            }
          />
        )}
      </View>
    );
  }

  const tabs: { key: Tab | 'file'; icon: string; label: string; color: string }[] = [
    { key: 'gallery', icon: 'images', label: tr('chat.attach.gallery'), color: '#3E9CF0' },
    { key: 'file', icon: 'document', label: tr('chat.attach.file'), color: '#4CB5E8' },
    { key: 'location', icon: 'location', label: tr('chat.attach.location'), color: '#5CBF5E' },
    { key: 'contact', icon: 'person', label: tr('chat.attach.contact'), color: '#F0A93E' },
  ];

  const footer =
    tab === 'gallery' && selected.length > 0 ? (
      <View style={[styles.captionBar, { borderTopColor: c.border }]}>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={tr('chat.attach.caption')}
          placeholderTextColor={c.textTertiary}
          multiline
          maxLength={4096}
          style={[styles.captionInput, { color: c.text, backgroundColor: c.surfaceHighlight }]}
        />
        <Pressable
          onPress={sendSelected}
          disabled={busy}
          style={[styles.sendBtn, { backgroundColor: c.primary }]}
          accessibilityRole="button"
          accessibilityLabel={tr('chat.send')}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send" size={20} color="#FFFFFF" style={{ marginLeft: 3 }} />}
          <View style={[styles.countBadge, { borderColor: c.surface, backgroundColor: c.primary }]}>
            <Text style={styles.countText}>{selected.length}</Text>
          </View>
        </Pressable>
      </View>
    ) : (
      <View style={styles.tabBarWrap}>
        <View style={[styles.tabBar, { backgroundColor: c.surfaceHighlight }]}>
          {tabs.map((tb) => {
            const active = tb.key === tab;
            return (
              <Pressable
                key={tb.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (tb.key === 'file') pickFile();
                  else setTab(tb.key);
                }}
                style={[styles.tabItem, active && { backgroundColor: theme.isDark ? '#FFFFFF14' : '#0000000D' }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.tabIcon, { backgroundColor: tb.color }]}>
                  <Ionicons name={tb.icon} size={18} color="#FFFFFF" />
                </View>
                <Text style={[styles.tabLabel, { color: active ? c.primary : c.textSecondary }]} numberOfLines={1}>
                  {tb.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, styles.backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={tr('common.close')} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(240)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { backgroundColor: c.surface }, sheetStyle]}
      >
        <View {...pan.panHandlers}>
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: c.textTertiary }]} />
          </View>
          <View style={styles.headerRow}>
            <Pressable onPress={close} hitSlop={8} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel={tr('common.close')}>
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>
              {title}
            </Text>
            {tab === 'gallery' && perm === 'granted' ? (
              <Pressable
                onPress={openSystemGallery}
                hitSlop={8}
                style={styles.headerBtn}
                accessibilityRole="button"
                accessibilityLabel={tr('chat.attach.chooseFromGallery')}
              >
                <Ionicons name="albums-outline" size={22} color={c.text} />
              </Pressable>
            ) : (
              <View style={styles.headerBtn} />
            )}
          </View>
        </View>
        <View style={{ flex: 1 }}>{body}</View>
        {hint ? (
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        ) : null}
        {footer}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 2 },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', height: 46, paddingHorizontal: 8 },
  headerBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', marginLeft: 6 },
  loader: { marginTop: 32 },
  cameraTile: { backgroundColor: '#1F2933', alignItems: 'center', justifyContent: 'center', marginBottom: GAP },
  tileImageSelected: { margin: 8, borderRadius: 4 },
  durationBadge: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  durationText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  tileCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCircleOff: { borderColor: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.2)' },
  tileCircleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 24, fontSize: 15, paddingHorizontal: 24 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  cardText: { fontSize: 14.5, textAlign: 'center', lineHeight: 20 },
  primaryBtn: { borderRadius: 10, paddingHorizontal: 22, paddingVertical: 11, marginTop: 6, alignItems: 'center' },
  fullBtn: { alignSelf: 'stretch', marginTop: 14 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  linkBtn: { paddingVertical: 6 },
  linkBtnText: { fontSize: 15, fontWeight: '600' },
  locCard: { alignSelf: 'stretch', borderRadius: 14, padding: 16 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  locTitle: { fontSize: 16, fontWeight: '600' },
  locCoords: { fontSize: 13.5, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  contactName: { fontSize: 16, fontWeight: '500' },
  contactSub: { fontSize: 13.5, marginTop: 1 },
  tabBarWrap: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
  tabBar: { flexDirection: 'row', borderRadius: 28, padding: 4 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 24, gap: 3 },
  tabIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 12, fontWeight: '500' },
  captionBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  captionInput: { flex: 1, fontSize: 16, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, maxHeight: 120 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  countBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 90,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '86%',
  },
  hintText: { color: '#FFFFFF', fontSize: 14, textAlign: 'center' },
});
