/**
 * Xotiradan foydalanish (Telegram'dagi "Storage Usage"):
 * - halqa diagramma: kesh toifalar bo'yicha (getStorageStatistics → by_chat[].by_file_type[]);
 * - belgilangan toifalarni tozalash (optimizeStorage file_types bilan);
 * - mediani saqlash muddati (prefs.keepMedia) va kesh chegarasi (prefs.maxCacheGb);
 * - eng ko'p joy egallagan chatlar va chat bo'yicha tozalash.
 * Xabarlar serverda qoladi — faqat telefondagi nusxalar o'chadi.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { useUIStore } from '@/stores/ui.store';
import { useChatStore } from '@/stores/chat.store';
import {
  FILE_CATEGORIES,
  categoryOfFileType,
  formatBytes,
  getStorageFast,
  getStorageStats,
  optimizeStorage,
  type FileCategory,
  type TdStorageFast,
  type TdStorageStatistics,
} from '@/services/tdlib/storage';
import { getChatTitle } from '@/services/tdlib/folders';
import { DonutChart, percentLabel } from '@/components/ui/DonutChart';
import Avatar from '@/components/common/Avatar';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showActionSheet, showAlert } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<SettingsStackParamList, 'Storage'>;

interface CategoryStat {
  key: FileCategory;
  size: number;
  count: number;
  /** Statistikada uchragan aniq TDLib turlari (tozalash uchun). */
  types: Set<string>;
}

const KEEP_OPTIONS = [1, 7, 30, 0];
const CACHE_OPTIONS = [5, 16, 32, 0];

function aggregate(stats: TdStorageStatistics): Map<FileCategory, CategoryStat> {
  const map = new Map<FileCategory, CategoryStat>();
  for (const ch of stats.by_chat ?? []) {
    for (const ft of ch.by_file_type ?? []) {
      const type = ft.file_type?.['@type'] ?? 'fileTypeUnknown';
      const key = categoryOfFileType(type);
      let s = map.get(key);
      if (!s) {
        s = { key, size: 0, count: 0, types: new Set() };
        map.set(key, s);
      }
      s.size += ft.size || 0;
      s.count += ft.count || 0;
      s.types.add(type);
    }
  }
  return map;
}

export function StorageScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const keepMedia = useUIStore((s) => s.keepMedia);
  const maxCacheGb = useUIStore((s) => s.maxCacheGb);
  const setPrefs = useUIStore((s) => s.setPrefs);
  const storeChats = useChatStore((s) => s.chats);

  const [fast, setFast] = useState<TdStorageFast | null>(null);
  const [stats, setStats] = useState<TdStorageStatistics | null>(null);
  const [selected, setSelected] = useState<Set<FileCategory>>(() => new Set(FILE_CATEGORIES.map((x) => x.key)));
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    getStorageFast().then(setFast).catch(() => undefined);
    getStorageStats(100)
      .then(setStats)
      .catch((e: Error) => showAlert(t('common.error'), e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(load, [load]);

  const cats = useMemo(() => (stats ? aggregate(stats) : null), [stats]);
  const rows = useMemo(
    () =>
      FILE_CATEGORIES.map((def) => ({ def, stat: cats?.get(def.key) })).filter(
        (r): r is { def: (typeof FILE_CATEGORIES)[number]; stat: CategoryStat } => !!r.stat && r.stat.size > 0,
      ),
    [cats],
  );
  const total = rows.reduce((a, r) => a + r.stat.size, 0);
  const selectedSize = rows.reduce((a, r) => a + (selected.has(r.def.key) ? r.stat.size : 0), 0);

  // Chatlar (hajm bo'yicha), nomlari store'dan yoki getChat'dan.
  const chatRows = useMemo(
    () => (stats?.by_chat ?? []).filter((ch) => ch.size > 0).sort((a, b) => b.size - a.size),
    [stats],
  );
  const storeMap = useMemo(() => new Map(storeChats.map((x) => [x.id, x])), [storeChats]);
  useEffect(() => {
    const missing = chatRows
      .map((ch) => String(ch.chat_id))
      .filter((id) => id !== '0' && !storeMap.has(id) && names[id] === undefined);
    if (missing.length === 0) return;
    void Promise.all(
      missing.map((id) =>
        getChatTitle(Number(id)).then(
          (title) => [id, title] as const,
          () => [id, ''] as const,
        ),
      ),
    ).then((pairs) => setNames((prev) => ({ ...prev, ...Object.fromEntries(pairs) })));
  }, [chatRows, storeMap, names]);

  const toggle = (k: FileCategory) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const runClear = (params: Parameters<typeof optimizeStorage>[0]) => {
    setBusy(true);
    optimizeStorage(params)
      .then((deleted) => {
        showAlert(t('data.storage.cleared'), t('data.storage.freed', { size: formatBytes(deleted.size || 0) }));
      })
      .catch((e: Error) => showAlert(t('common.error'), e.message))
      .finally(() => {
        setBusy(false);
        load();
      });
  };

  const clearSelected = () => {
    const types = new Set<string>();
    for (const r of rows) if (selected.has(r.def.key)) r.stat.types.forEach((x) => types.add(x));
    if (types.size === 0) return;
    showAlert(t('data.storage.clearTitle'), t('data.storage.clearConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('data.storage.clearButton'),
        style: 'destructive',
        onPress: () => runClear({ file_types: [...types] }),
      },
    ]);
  };

  const chatName = (id: number): string => {
    if (id === 0) return t('data.storage.otherChats');
    const s = storeMap.get(String(id));
    return s?.name || names[String(id)] || t('data.storage.unknownChat');
  };

  const clearChat = (id: number, size: number) =>
    showAlert(chatName(id), t('data.storage.clearChatConfirm', { size: formatBytes(size) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('data.storage.clearButton'),
        style: 'destructive',
        onPress: () => runClear({ chat_ids: [id] }),
      },
    ]);

  const keepLabel = (days: number) =>
    days === 1
      ? t('data.keep.day')
      : days === 7
      ? t('data.keep.week')
      : days === 30
      ? t('data.keep.month')
      : days === 0
      ? t('common.never')
      : t.p('data.keep.days', days);

  const pickKeep = (kind: 'private' | 'groups' | 'channels') =>
    showActionSheet({
      title: t('data.keep.title'),
      options: KEEP_OPTIONS.map((d) => ({
        text: keepLabel(d),
        icon: keepMedia[kind] === d ? 'checkmark' : undefined,
        onPress: () => setPrefs({ keepMedia: { ...keepMedia, [kind]: d } }),
      })),
    });

  const cacheLabel = (gb: number) => (gb === 0 ? t('data.cache.noLimit') : `${gb} GB`);
  const cacheIndex = Math.max(0, CACHE_OPTIONS.indexOf(maxCacheGb));

  const loadingTotal = fast ? (fast.files_size || 0) + (fast.database_size || 0) : null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('data.storage.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Diagramma + toifalar */}
        <View style={[styles.chartCard, { backgroundColor: c.surface }]}>
          {stats === null ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <DonutChart
                segments={[]}
                centerLabel={loadingTotal === null ? '…' : formatBytes(loadingTotal)}
                centerSubLabel={t('data.storage.calculating')}
              />
              <ActivityIndicator style={{ marginTop: 16 }} color={c.primary} />
            </View>
          ) : (
            <>
              <View style={{ paddingTop: 20 }}>
                <DonutChart
                  segments={rows
                    .filter((r) => selected.has(r.def.key))
                    .map((r) => ({ key: r.def.key, value: r.stat.size, color: r.def.color }))}
                  centerLabel={formatBytes(selectedSize)}
                  centerSubLabel={total === 0 ? t('data.storage.empty') : undefined}
                />
              </View>
              <Text style={[styles.chartTitle, { color: c.text }]}>{t('data.storage.title')}</Text>
              <Text style={[styles.chartSub, { color: c.textSecondary }]}>{t('data.storage.hint')}</Text>

              {rows.map((r, i) => {
                const on = selected.has(r.def.key);
                return (
                  <Pressable
                    key={r.def.key}
                    onPress={() => toggle(r.def.key)}
                    android_ripple={{ color: c.surfaceHighlight }}
                    style={styles.catRow}
                  >
                    <View
                      style={[
                        styles.check,
                        { borderColor: r.def.color, backgroundColor: on ? r.def.color : 'transparent' },
                      ]}
                    >
                      {on ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                    </View>
                    <View
                      style={[
                        styles.catBody,
                        i < rows.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
                      ]}
                    >
                      <Text style={[styles.catLabel, { color: c.text }]} numberOfLines={1}>
                        {t(`data.cat.${r.def.key}`)}
                        <Text style={{ color: c.textSecondary }}>{`  ${percentLabel(total ? r.stat.size / total : 0)}`}</Text>
                      </Text>
                      <Text style={[styles.catValue, { color: c.textSecondary }]}>{formatBytes(r.stat.size)}</Text>
                    </View>
                  </Pressable>
                );
              })}

              {fast ? (
                <View style={styles.dbRow}>
                  <Text style={{ color: c.textSecondary, fontSize: 13.5, flex: 1 }}>{t('data.storage.database')}</Text>
                  <Text style={{ color: c.textSecondary, fontSize: 13.5 }}>{formatBytes(fast.database_size || 0)}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={busy || selectedSize === 0 ? undefined : clearSelected}
                style={[
                  styles.clearBtn,
                  { backgroundColor: c.primary, opacity: busy || selectedSize === 0 ? 0.5 : 1 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.clearText}>
                    {t('data.storage.clearCache', { size: formatBytes(selectedSize) })}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        {/* Mediani saqlash muddati */}
        <SettingsCard title={t('data.keep.title')} footer={t('data.keep.footer')}>
          <SettingsRow
            icon="person"
            color="#3E9BEA"
            label={t('data.keep.private')}
            value={keepLabel(keepMedia.private)}
            onPress={() => pickKeep('private')}
          />
          <SettingsRow
            icon="people"
            color="#4FBC6B"
            label={t('data.keep.groups')}
            value={keepLabel(keepMedia.groups)}
            onPress={() => pickKeep('groups')}
          />
          <SettingsRow
            icon="megaphone"
            color="#F2A23A"
            label={t('data.keep.channels')}
            value={keepLabel(keepMedia.channels)}
            onPress={() => pickKeep('channels')}
            last
          />
        </SettingsCard>

        {/* Maksimal kesh hajmi */}
        <SettingsCard title={t('data.cache.title')} footer={t('data.cache.footer')}>
          <View style={styles.slider}>
            <View style={styles.sliderTrackWrap}>
              <View style={[styles.sliderTrack, { backgroundColor: c.border }]} />
              <View
                style={[
                  styles.sliderTrack,
                  { backgroundColor: c.primary, width: `${(cacheIndex / (CACHE_OPTIONS.length - 1)) * 100}%` },
                ]}
              />
              <View style={styles.sliderDots}>
                {CACHE_OPTIONS.map((gb, i) => (
                  <Pressable
                    key={gb}
                    hitSlop={14}
                    onPress={() => setPrefs({ maxCacheGb: gb })}
                    style={[
                      i === cacheIndex ? styles.knob : styles.dot,
                      { backgroundColor: i <= cacheIndex ? c.primary : c.border },
                    ]}
                  />
                ))}
              </View>
            </View>
            <View style={styles.sliderLabels}>
              {CACHE_OPTIONS.map((gb, i) => (
                <Pressable key={gb} onPress={() => setPrefs({ maxCacheGb: gb })} hitSlop={8}>
                  <Text
                    style={{
                      fontSize: 13.5,
                      color: i === cacheIndex ? c.primary : c.textSecondary,
                      fontWeight: i === cacheIndex ? '700' : '400',
                    }}
                  >
                    {cacheLabel(gb)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </SettingsCard>

        {/* Chatlar */}
        {chatRows.length > 0 ? (
          <SettingsCard title={t('data.storage.chats')} footer={t('data.storage.chatsFooter')}>
            {chatRows.map((ch, i) => {
              const id = ch.chat_id;
              const s = storeMap.get(String(id));
              const name = chatName(id);
              return (
                <Pressable
                  key={String(id)}
                  onPress={busy ? undefined : () => clearChat(id, ch.size)}
                  android_ripple={{ color: c.surfaceHighlight }}
                  style={styles.chatRow}
                >
                  {id === 0 ? (
                    <View style={[styles.otherAvatar, { backgroundColor: c.surfaceHighlight }]}>
                      <Ionicons name="folder" size={20} color={c.textSecondary} />
                    </View>
                  ) : (
                    <Avatar uri={s?.avatarUrl} name={name} size={40} />
                  )}
                  <View
                    style={[
                      styles.chatBody,
                      i < chatRows.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                  >
                    <Text style={[styles.catLabel, { color: c.text, flex: 1 }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.catValue, { color: c.textSecondary }]}>{formatBytes(ch.size)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </SettingsCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chartCard: { marginHorizontal: 12, marginTop: 14, borderRadius: 14, overflow: 'hidden', paddingBottom: 14 },
  chartTitle: { fontSize: 19, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  chartSub: { fontSize: 13.5, textAlign: 'center', marginTop: 4, marginHorizontal: 24, marginBottom: 8, lineHeight: 18 },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, minHeight: 48 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  catBody: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingRight: 16 },
  catLabel: { fontSize: 16, flex: 1 },
  catValue: { fontSize: 15, marginLeft: 8 },
  dbRow: { flexDirection: 'row', paddingHorizontal: 18, paddingTop: 10 },
  clearBtn: {
    marginHorizontal: 16,
    marginTop: 14,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  slider: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 14 },
  sliderTrackWrap: { height: 22, justifyContent: 'center', marginHorizontal: 18 },
  sliderTrack: { position: 'absolute', left: 0, height: 3, borderRadius: 2, right: undefined, width: '100%' },
  sliderDots: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  knob: { width: 22, height: 22, borderRadius: 11, marginHorizontal: -5 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, minHeight: 58 },
  otherAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chatBody: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 58, marginLeft: 14, paddingRight: 16 },
});
