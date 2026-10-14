/**
 * Telegram'dagi kabi kunduzgi/tungi rejimga animatsiya bilan o'tish:
 * eski ekran surati ustiga qo'yiladi, ostida mavzu almashadi va suratda
 * bosilgan nuqtadan kengayib boruvchi doira "teshik" ochiladi.
 *
 *   <ThemeRevealHost />                // App ildizida bir marta
 *   toggleThemeAnimated(x, y)          // x, y — bosilgan nuqta (pageX/pageY)
 */
import React, { useEffect, useState } from 'react';
import { Appearance, Dimensions, StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Image as SvgImage, Mask, Rect } from 'react-native-svg';
import { AppNative } from '@/services/native';
import { useUIStore } from '@/stores/ui.store';
import * as Haptics from '@/utils/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Reveal = { uri: string; x: number; y: number } | null;
let setGlobal: ((r: Reveal) => void) | null = null;
let busy = false;

function nextMode(): 'dark' | 'light' {
  const { themeMode } = useUIStore.getState();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && Appearance.getColorScheme() !== 'light');
  return isDark ? 'light' : 'dark';
}

/** Mavzuni (dark ↔ light) animatsiya bilan almashtiradi. */
export async function toggleThemeAnimated(x?: number, y?: number): Promise<void> {
  if (busy) return;
  const mode = nextMode();
  const { width, height } = Dimensions.get('window');
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  if (!setGlobal || !AppNative?.captureScreen) {
    useUIStore.getState().setThemeMode(mode);
    return;
  }
  busy = true;
  try {
    const uri = await AppNative.captureScreen();
    setGlobal({ uri, x: x ?? width / 2, y: y ?? height / 2 });
    // Surat chizilgach mavzuni almashtiramiz (host o'zi animatsiyani boshlaydi).
    setTimeout(() => useUIStore.getState().setThemeMode(mode), 60);
  } catch {
    useUIStore.getState().setThemeMode(mode);
    busy = false;
  }
}

export function ThemeRevealHost(): React.JSX.Element | null {
  const [reveal, setReveal] = useState<Reveal>(null);
  const r = useSharedValue(0);
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    setGlobal = setReveal;
    return () => {
      setGlobal = null;
    };
  }, []);

  useEffect(() => {
    if (!reveal) return;
    r.value = 0;
    const max = Math.hypot(Math.max(reveal.x, width - reveal.x), Math.max(reveal.y, height - reveal.y));
    const done = () => {
      setReveal(null);
      busy = false;
    };
    // Mavzu almashib, yangi ekran chizilishiga vaqt beramiz.
    const timer = setTimeout(() => {
      r.value = withTiming(max, { duration: 520, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(done)();
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [reveal, r, width, height]);

  const circleProps = useAnimatedProps(() => ({ r: r.value }));

  if (!reveal) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <Mask id="themeHole" x="0" y="0" width={width} height={height} maskUnits="userSpaceOnUse">
            <Rect x="0" y="0" width={width} height={height} fill="white" />
            <AnimatedCircle cx={reveal.x} cy={reveal.y} fill="black" animatedProps={circleProps} />
          </Mask>
        </Defs>
        <SvgImage
          x="0"
          y="0"
          width={width}
          height={height}
          href={{ uri: reveal.uri }}
          preserveAspectRatio="xMidYMid slice"
          mask="url(#themeHole)"
        />
      </Svg>
    </View>
  );
}
