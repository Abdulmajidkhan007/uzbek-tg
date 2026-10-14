/**
 * Chat foni: galereyadan rasm, bir rangli fon yoki gradient. Tanlov darhol
 * saqlanadi va tepadagi namunada ko'rinadi (chat ekranida ham shu fon).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import type { StackScreenProps } from '@react-navigation/stack';
import type { SettingsStackParamList } from '@/navigation/types';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { useUIStore, type Wallpaper } from '@/stores/ui.store';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showAlert } from '@/components/ui/Dialog';
import { WallpaperView } from '@/components/chat/ChatBackground';
import { ChatPreview } from './ChatSettingsScreen';
import * as Haptics from '@/utils/haptics';

type Props = StackScreenProps<SettingsStackParamList, 'ChatWallpaper'>;

/** Bir rangli fonlar (yorug' va qorong'i). */
const SOLID_COLORS = [
  '#D6E4EE', '#CDE7C9', '#F2E6C9', '#F3D3D3', '#E1D7F0', '#C9E8E6',
  '#0E1621', '#1A2633', '#1C2A1F', '#2B2134', '#2E2418', '#121212',
];

/** Telegram'ga o'xshash gradient to'plamlari. */
const GRADIENTS: string[][] = [
  // Yorug'
  ['#DBDDBB', '#6BA587', '#D5D88D', '#88B884'],
  ['#8DC0EB', '#B9D1EA', '#C6B1EF', '#EBD7EF'],
  ['#97BEEB', '#B1E9EA', '#C6B1EF', '#EFB7DC'],
  ['#E4B2EA', '#8376C2', '#EAB9D9', '#B493E6'],
  ['#FFC3B2', '#E2C0FF', '#FFE7B2', '#F8E2DB'],
  ['#F9E1B4', '#F2B88A', '#F7CFA5', '#EFA382'],
  ['#C6E7CB', '#8FD3D8', '#BCE1C2', '#A6D9E6'],
  ['#F0F0F0', '#DCE3EC', '#E9E4F0', '#D8E2DC'],
  // Qorong'i
  ['#0E1621', '#17212B'],
  ['#1B2836', '#121A24', '#24364A'],
  ['#2A2F4A', '#151826', '#3B2F5A'],
  ['#0F2027', '#203A43', '#2C5364'],
  ['#1F1C2C', '#3A2F4B', '#28233A'],
  ['#232526', '#414345'],
  ['#16222A', '#3A6073'],
  ['#2C1A1D', '#3D2128', '#1C1012'],
];

function sameWallpaper(a: Wallpaper, b: Wallpaper): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'none') return true;
  if (a.type === 'gradient' && b.type === 'gradient') return a.value.join() === b.value.join();
  return (a as { value: string }).value === (b as { value: string }).value;
}

function Tile({
  wallpaper,
  selected,
  onPress,
  width,
  height,
  label,
}: {
  wallpaper: Wallpaper;
  selected: boolean;
  onPress: () => void;
  width: number;
  height: number;
  label?: string;
}): React.JSX.Element {
  const c = useTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, { width, height, borderColor: selected ? c.primary : 'transparent' }]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View style={styles.tileInner}>
        <WallpaperView wallpaper={wallpaper} />
        {label ? (
          <View style={styles.tileLabelWrap}>
            <Text style={[styles.tileLabel, { color: c.textSecondary }]}>{label}</Text>
          </View>
        ) : null}
        {selected ? (
          <View style={[styles.check, { backgroundColor: c.primary }]}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ChatWallpaperScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const { width } = useWindowDimensions();
  const wallpaper = useUIStore((s) => s.wallpaper);
  const setPrefs = useUIStore((s) => s.setPrefs);
  const [showColors, setShowColors] = useState(wallpaper.type === 'color');

  const gap = 8;
  const tileW = Math.floor((width - 24 - 24 - gap * 2) / 3);
  const tileH = Math.round((tileW * 16) / 9);
  const colorW = Math.floor((width - 24 - 24 - gap * 5) / 6);

  const select = (w: Wallpaper) => {
    Haptics.selectionAsync();
    setPrefs({ wallpaper: w });
  };

  const pickFromGallery = async () => {
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.9 });
      const uri = res.assets?.[0]?.uri;
      if (res.didCancel || !uri) return;
      if (res.errorCode) throw new Error(res.errorMessage ?? res.errorCode);
      select({ type: 'image', value: uri });
    } catch (e) {
      showAlert(t('appearance.wallpaper.pickFailed'), e instanceof Error ? e.message : String(e));
    }
  };

  const tiles = useMemo<Wallpaper[]>(
    () => [{ type: 'none' }, ...GRADIENTS.map((g) => ({ type: 'gradient' as const, value: g }))],
    [],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('appearance.wallpaper.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.previewCard, { backgroundColor: c.surface }]}>
          <ChatPreview height={190} />
        </View>

        <SettingsCard>
          <SettingsRow
            icon="images-outline"
            color="#5DBB6B"
            label={t('appearance.wallpaper.gallery')}
            onPress={() => void pickFromGallery()}
            right={
              wallpaper.type === 'image' ? (
                <Ionicons name="checkmark-circle" size={20} color={c.primary} />
              ) : undefined
            }
          />
          <SettingsRow
            icon="color-palette-outline"
            color="#F0A04B"
            label={t('appearance.wallpaper.color')}
            onPress={() => setShowColors((v) => !v)}
            last
            right={
              <Ionicons name={showColors ? 'chevron-up' : 'chevron-down'} size={18} color={c.textTertiary} />
            }
          />
          {showColors ? (
            <View style={[styles.colorGrid, { gap }]}>
              {SOLID_COLORS.map((col) => {
                const w: Wallpaper = { type: 'color', value: col };
                const on = sameWallpaper(wallpaper, w);
                return (
                  <Pressable
                    key={col}
                    onPress={() => select(w)}
                    style={[
                      styles.colorDot,
                      { width: colorW, height: colorW, borderRadius: colorW / 2, backgroundColor: col },
                      { borderColor: on ? c.primary : c.border },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    {on ? <Ionicons name="checkmark" size={18} color={c.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </SettingsCard>

        <SettingsCard title={t('appearance.wallpaper.gradients')}>
          <View style={[styles.grid, { gap }]}>
            {tiles.map((w, i) => (
              <Tile
                key={i}
                wallpaper={w}
                width={tileW}
                height={tileH}
                selected={sameWallpaper(wallpaper, w)}
                onPress={() => select(w)}
                label={w.type === 'none' ? t('appearance.wallpaper.default') : undefined}
              />
            ))}
          </View>
        </SettingsCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  previewCard: { marginHorizontal: 12, marginTop: 12, borderRadius: 14, overflow: 'hidden' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12 },
  colorDot: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12 },
  tile: { borderWidth: 2, borderRadius: 12, padding: 2 },
  tileInner: { flex: 1, borderRadius: 9, overflow: 'hidden' },
  tileLabelWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 13, fontWeight: '600' },
  check: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
