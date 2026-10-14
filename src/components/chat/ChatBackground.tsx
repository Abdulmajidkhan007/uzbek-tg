/**
 * Chat foni (Chat sozlamalari → Fon): rang, gradient yoki galereyadan rasm.
 * Chat ekranida xabarlar ostida absolute qilib qo'yiladi.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useUIStore, type Wallpaper } from '@/stores/ui.store';
import { useTheme } from '@/hooks/useTheme';

export function WallpaperView({ wallpaper, style }: { wallpaper: Wallpaper; style?: object }): React.JSX.Element {
  const c = useTheme().colors;
  if (wallpaper.type === 'image') {
    return <Image source={{ uri: wallpaper.value }} style={[StyleSheet.absoluteFill, style]} resizeMode="cover" />;
  }
  if (wallpaper.type === 'color') {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: wallpaper.value }, style]} />;
  }
  if (wallpaper.type === 'gradient') {
    const stops = wallpaper.value;
    return (
      <View style={[StyleSheet.absoluteFill, style]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="wp" x1="0" y1="0" x2="1" y2="1">
              {stops.map((col, i) => (
                <Stop key={i} offset={stops.length === 1 ? 0 : i / (stops.length - 1)} stopColor={col} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#wp)" />
        </Svg>
      </View>
    );
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background }, style]} />;
}

/** Joriy tanlangan fon. */
export function ChatBackground(): React.JSX.Element {
  const wallpaper = useUIStore((s) => s.wallpaper);
  return <WallpaperView wallpaper={wallpaper} />;
}
