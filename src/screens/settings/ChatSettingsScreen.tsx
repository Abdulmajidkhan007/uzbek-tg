/**
 * Chat sozlamalari (Telegram Android'dagi tartib): tepada fon va ikkita
 * namuna xabar (shrift, burchak, rang va mavzu o'zgarishi darhol ko'rinadi),
 * matn o'lchami, fon, rang mavzusi, kunduzgi/tungi rejim, xabar burchaklari,
 * chatlar ro'yxati ko'rinishi va "Enter bilan yuborish".
 * Faqat ishlaydigan sozlamalar ko'rsatiladi.
 */
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { StackScreenProps } from '@react-navigation/stack';
import type { SettingsStackParamList } from '@/navigation/types';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { useUIStore, type AccentKey } from '@/stores/ui.store';
import { ACCENTS, ACCENT_ORDER } from '@/theme/accents';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Slider } from '@/components/ui/Slider';
import { toggleThemeAnimated } from '@/components/ui/ThemeReveal';
import { WallpaperView } from '@/components/chat/ChatBackground';
import * as Haptics from '@/utils/haptics';

type Props = StackScreenProps<SettingsStackParamList, 'ChatSettings'>;

// ---------------------------------------------------------------------------
// Namuna chat (fon + ikki xabar) — Fon ekranida ham ishlatiladi
// ---------------------------------------------------------------------------

export function ChatPreview({ height = 210 }: { height?: number }): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const t = useT();
  const wallpaper = useUIStore((s) => s.wallpaper);
  const fs = useUIStore((s) => s.messageFontSize);
  const radius = useUIStore((s) => s.bubbleRadius);
  const small = Math.min(radius, 6);
  const meta = theme.isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const outMeta = theme.isDark ? 'rgba(255,255,255,0.6)' : c.primary;

  return (
    <View style={[styles.preview, { height }]}>
      <WallpaperView wallpaper={wallpaper} />
      <View style={styles.previewInner}>
        <View
          style={[
            styles.bubble,
            styles.bubbleIn,
            {
              backgroundColor: c.messageBubbleIncoming,
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
              borderBottomRightRadius: radius,
              borderBottomLeftRadius: small,
            },
          ]}
        >
          <View style={[styles.quote, { borderLeftColor: c.primary, backgroundColor: c.primary + '1A' }]}>
            <Text style={[styles.quoteName, { color: c.primary, fontSize: fs - 2 }]} numberOfLines={1}>
              {t('appearance.preview.replyName')}
            </Text>
            <Text style={{ color: c.messageBubbleIncomingText, fontSize: fs - 2 }} numberOfLines={1}>
              {t('appearance.preview.reply')}
            </Text>
          </View>
          <Text style={{ color: c.messageBubbleIncomingText, fontSize: fs, lineHeight: fs * 1.3 }}>
            {t('appearance.preview.incoming')}
            <Text style={styles.metaSpacer}>{'          '}</Text>
          </Text>
          <Text style={[styles.meta, { color: meta }]}>10:42</Text>
        </View>

        <View
          style={[
            styles.bubble,
            styles.bubbleOut,
            {
              backgroundColor: c.messageBubbleOutgoing,
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
              borderBottomLeftRadius: radius,
              borderBottomRightRadius: small,
            },
          ]}
        >
          <Text style={{ color: c.messageBubbleOutgoingText, fontSize: fs, lineHeight: fs * 1.3 }}>
            {t('appearance.preview.outgoing')}
            <Text style={styles.metaSpacer}>{'                '}</Text>
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: outMeta }]}>10:43</Text>
            <Ionicons name="checkmark-done" size={15} color={outMeta} style={{ marginLeft: 3 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rang mavzusi plitkasi
// ---------------------------------------------------------------------------

function AccentTile({
  accent,
  selected,
  onPress,
}: {
  accent: AccentKey;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const t = useT();
  const a = ACCENTS[accent];
  const main = theme.isDark ? a.dark : a.light;
  const bubble = theme.isDark ? a.bubbleDark : a.bubbleLight;
  return (
    <Pressable onPress={onPress} style={styles.accentItem} accessibilityRole="radio" accessibilityState={{ selected }}>
      <View style={[styles.accentRing, { borderColor: selected ? main : 'transparent' }]}>
        <View style={[styles.accentTile, { backgroundColor: theme.isDark ? '#0E1621' : '#DCE6EE' }]}>
          <View style={[styles.miniIn, { backgroundColor: c.messageBubbleIncoming }]} />
          <View style={[styles.miniOut, { backgroundColor: bubble }]} />
          <View style={[styles.miniDot, { backgroundColor: main }]}>
            {selected ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
          </View>
        </View>
      </View>
      <Text style={[styles.accentName, { color: selected ? main : c.textSecondary }]} numberOfLines={1}>
        {t(`appearance.accent.${accent}`)}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Ro'yxat ko'rinishi (2 / 3 qator) kartochkasi
// ---------------------------------------------------------------------------

function LinesOption({
  lines,
  selected,
  onPress,
}: {
  lines: 2 | 3;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const bar = (w: number | `${number}%`, color: string, h = 5) => (
    <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: color, marginTop: 4 }} />
  );
  return (
    <Pressable
      onPress={onPress}
      style={[styles.linesCard, { borderColor: selected ? c.primary : c.border, backgroundColor: c.background }]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      {[0, 1].map((i) => (
        <View key={i} style={styles.linesRow}>
          <View style={[styles.linesAvatar, { backgroundColor: c.primary + (i === 0 ? '' : '99') }]} />
          <View style={{ flex: 1 }}>
            {bar('55%', c.textSecondary, 6)}
            {bar('90%', c.border)}
            {lines === 3 ? bar('70%', c.border) : null}
          </View>
        </View>
      ))}
      <View style={styles.linesFooter}>
        <Ionicons
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={selected ? c.primary : c.textTertiary}
        />
        <Text style={[styles.linesLabel, { color: c.text }]}>
          {lines === 2 ? t('appearance.twoLines') : t('appearance.threeLines')}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Ekran
// ---------------------------------------------------------------------------

export function ChatSettingsScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const t = useT();
  const fontSize = useUIStore((s) => s.messageFontSize);
  const radius = useUIStore((s) => s.bubbleRadius);
  const accent = useUIStore((s) => s.accent);
  const themeMode = useUIStore((s) => s.themeMode);
  const lines = useUIStore((s) => s.chatListLines);
  const sendWithEnter = useUIStore((s) => s.sendWithEnter);
  const setPrefs = useUIStore((s) => s.setPrefs);

  const onToggleDayNight = (e: GestureResponderEvent) => {
    void toggleThemeAnimated(e.nativeEvent.pageX, e.nativeEvent.pageY);
  };

  const valueText = (v: number) => (
    <Text style={[styles.sliderValue, { color: c.primary }]}>{v}</Text>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('appearance.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.previewCard, { backgroundColor: c.surface }]}>
          <ChatPreview />
        </View>

        <SettingsCard title={t('appearance.textSize')}>
          <View style={styles.sliderBox}>
            <Slider
              min={12}
              max={24}
              step={1}
              value={fontSize}
              onChange={(v) => setPrefs({ messageFontSize: v })}
              ticks
              leftLabel={<Text style={{ color: c.textSecondary, fontSize: 13 }}>A</Text>}
              rightLabel={valueText(fontSize)}
              accessibilityLabel={t('appearance.textSize')}
            />
          </View>
          <View style={[styles.sep, { backgroundColor: c.border }]} />
          <SettingsRow
            icon="image-outline"
            color="#4FA3E3"
            label={t('appearance.changeWallpaper')}
            onPress={() => navigation.navigate('ChatWallpaper')}
            last
            right={<Ionicons name="chevron-forward" size={18} color={c.textTertiary} />}
          />
        </SettingsCard>

        <SettingsCard title={t('appearance.colorTheme')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accentList}>
            {ACCENT_ORDER.map((k) => (
              <AccentTile
                key={k}
                accent={k}
                selected={accent === k}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPrefs({ accent: k });
                }}
              />
            ))}
          </ScrollView>
          <View style={[styles.sep, { backgroundColor: c.border }]} />
          <Pressable
            onPress={onToggleDayNight}
            android_ripple={{ color: c.surfaceHighlight }}
            style={styles.modeRow}
            accessibilityRole="button"
          >
            <View style={[styles.modeIcon, { backgroundColor: theme.isDark ? '#F2A93B' : '#5B6AD0' }]}>
              <Ionicons name={theme.isDark ? 'sunny' : 'moon'} size={18} color="#FFFFFF" />
            </View>
            <Text style={[styles.modeText, { color: c.text }]}>
              {theme.isDark ? t('appearance.dayMode') : t('appearance.nightMode')}
            </Text>
          </Pressable>
          <View style={[styles.sep, { backgroundColor: c.border, marginLeft: 64 }]} />
          <SettingsRow
            icon="phone-portrait-outline"
            color="#8E8E93"
            label={t('appearance.system')}
            subtitle={t('appearance.systemSub')}
            onPress={() => {
              if (themeMode === 'system') setPrefs({ themeMode: theme.isDark ? 'dark' : 'light' });
              else setPrefs({ themeMode: 'system' });
            }}
            last
            right={
              <Switch
                value={themeMode === 'system'}
                onValueChange={(on) => setPrefs({ themeMode: on ? 'system' : theme.isDark ? 'dark' : 'light' })}
                trackColor={{ true: c.primary, false: c.border }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </SettingsCard>

        <SettingsCard title={t('appearance.corners')}>
          <View style={styles.sliderBox}>
            <Slider
              min={0}
              max={20}
              step={1}
              value={radius}
              onChange={(v) => setPrefs({ bubbleRadius: v })}
              leftLabel={<Ionicons name="square-outline" size={16} color={c.textSecondary} />}
              rightLabel={valueText(radius)}
              accessibilityLabel={t('appearance.corners')}
            />
          </View>
        </SettingsCard>

        <SettingsCard title={t('appearance.listView')}>
          <View style={styles.linesWrap}>
            <LinesOption lines={2} selected={lines === 2} onPress={() => setPrefs({ chatListLines: 2 })} />
            <LinesOption lines={3} selected={lines === 3} onPress={() => setPrefs({ chatListLines: 3 })} />
          </View>
        </SettingsCard>

        <SettingsCard title={t('appearance.other')}>
          <SettingsRow
            icon="return-down-back-outline"
            color="#5DBB6B"
            label={t('appearance.sendEnter')}
            subtitle={t('appearance.sendEnterSub')}
            onPress={() => setPrefs({ sendWithEnter: !sendWithEnter })}
            last
            right={
              <Switch
                value={sendWithEnter}
                onValueChange={(v) => setPrefs({ sendWithEnter: v })}
                trackColor={{ true: c.primary, false: c.border }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </SettingsCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  previewCard: { marginHorizontal: 12, marginTop: 12, borderRadius: 14, overflow: 'hidden' },
  preview: { overflow: 'hidden', justifyContent: 'center' },
  previewInner: { paddingHorizontal: 12, paddingVertical: 14 },
  bubble: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6, maxWidth: '82%' },
  bubbleIn: { alignSelf: 'flex-start', marginBottom: 8 },
  bubbleOut: { alignSelf: 'flex-end' },
  quote: { borderLeftWidth: 3, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 4 },
  quoteName: { fontWeight: '600' },
  metaSpacer: { fontSize: 12 },
  meta: { position: 'absolute', right: 9, bottom: 5, fontSize: 12 },
  metaRow: { position: 'absolute', right: 8, bottom: 5, flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12 },
  sliderBox: { paddingHorizontal: 12, paddingVertical: 8 },
  sliderValue: { fontSize: 15, fontWeight: '600', minWidth: 24, textAlign: 'right' },
  sep: { height: StyleSheet.hairlineWidth },
  accentList: { paddingHorizontal: 10, paddingVertical: 12 },
  accentItem: { alignItems: 'center', marginHorizontal: 4, width: 72 },
  accentRing: { borderWidth: 2, borderRadius: 14, padding: 2 },
  accentTile: { width: 62, height: 76, borderRadius: 11, overflow: 'hidden', padding: 6, justifyContent: 'center' },
  miniIn: { width: 34, height: 12, borderRadius: 6, marginBottom: 6 },
  miniOut: { width: 38, height: 12, borderRadius: 6, alignSelf: 'flex-end' },
  miniDot: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentName: { fontSize: 12, marginTop: 5 },
  modeRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, minHeight: 52 },
  modeIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 18 },
  modeText: { fontSize: 16 },
  linesWrap: { flexDirection: 'row', padding: 12, gap: 12 },
  linesCard: { flex: 1, borderWidth: 2, borderRadius: 12, padding: 10 },
  linesRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  linesAvatar: { width: 22, height: 22, borderRadius: 11, marginRight: 8 },
  linesFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  linesLabel: { fontSize: 14.5, marginLeft: 6, fontWeight: '500' },
});
