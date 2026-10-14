/**
 * Telegram uslubidagi slayder: ingichka yo'lak (to'ldirilgan qismi asosiy
 * rangda), dumaloq tutqich, qadam (step) bo'yicha qotish, ixtiyoriy belgilar.
 * ScrollView ichida ishlaydi: Pan faqat gorizontal harakatda faollashadi.
 *
 *   <Slider min={12} max={24} step={1} value={size} onChange={setSize} ticks />
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import * as Haptics from "@/utils/haptics";

export interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  /** Har bir qadamda kichik nuqta (qadamlar soni 30 dan oshmasa). */
  ticks?: boolean;
  /** Yo'lakning chap va o'ng tomonidagi yozuv/ikonka. */
  leftLabel?: React.ReactNode;
  rightLabel?: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const THUMB = 22;
const R = THUMB / 2;

export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  ticks,
  leftLabel,
  rightLabel,
  style,
  accessibilityLabel,
}: SliderProps): React.JSX.Element {
  const c = useTheme().colors;
  const [width, setWidth] = useState(0);
  const trackW = useSharedValue(0);
  const x = useSharedValue(0);
  const dragging = useSharedValue(false);
  const lastEmitted = useRef(value);
  // onChange har renderda yangi bo'lishi mumkin — gesture qayta yaratilmasin.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const range = Math.max(max - min, 1e-6);

  // Tashqaridan qiymat o'zgarsa (yoki o'lcham), tutqichni joyiga qo'yamiz.
  useEffect(() => {
    lastEmitted.current = value;
    if (!dragging.value && width > 0) {
      x.value = withTiming(
        ((Math.min(Math.max(value, min), max) - min) / range) * width,
        { duration: 120 },
      );
    }
  }, [value, width, min, max, range, x, dragging]);

  const emit = useCallback((v: number) => {
    if (v === lastEmitted.current) return;
    lastEmitted.current = v;
    Haptics.selectionAsync();
    onChangeRef.current(v);
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.max(e.nativeEvent.layout.width - THUMB, 0);
    trackW.value = w;
    setWidth(w);
  };

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onBegin(() => {
        dragging.value = true;
      })
      .onUpdate((e) => {
        const w = trackW.value;
        if (w <= 0) return;
        const px = Math.min(Math.max(e.x - R, 0), w);
        x.value = px;
        const raw = min + (px / w) * (max - min);
        const snapped = Math.round((raw - min) / step) * step + min;
        runOnJS(emit)(Math.min(Math.max(snapped, min), max));
      })
      .onFinalize((_e, success) => {
        const w = trackW.value;
        dragging.value = false;
        // Pan faollashmagan bo'lsa (oddiy bosish) — joyini Tap belgilaydi.
        if (!success || w <= 0) return;
        const raw = min + (x.value / w) * (max - min);
        const snapped = Math.min(
          Math.max(Math.round((raw - min) / step) * step + min, min),
          max,
        );
        x.value = withTiming(((snapped - min) / (max - min)) * w, {
          duration: 120,
        });
      });

    const tap = Gesture.Tap().onEnd((e) => {
      const w = trackW.value;
      if (w <= 0) return;
      const px = Math.min(Math.max(e.x - R, 0), w);
      const raw = min + (px / w) * (max - min);
      const snapped = Math.min(
        Math.max(Math.round((raw - min) / step) * step + min, min),
        max,
      );
      x.value = withTiming(((snapped - min) / (max - min)) * w, {
        duration: 140,
      });
      runOnJS(emit)(snapped);
    });

    return Gesture.Exclusive(pan, tap);
  }, [min, max, step, emit, trackW, x, dragging]);

  const fillStyle = useAnimatedStyle(() => ({ width: x.value }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const steps = Math.round(range / step);
  const showTicks = ticks && steps > 0 && steps <= 30 && width > 0;

  return (
    <View style={[styles.row, style]}>
      {leftLabel ? <View style={styles.side}>{leftLabel}</View> : null}
      <GestureDetector gesture={gesture}>
        <View
          style={styles.area}
          onLayout={onLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ min, max, now: value }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "increment")
              emit(Math.min(value + step, max));
            if (e.nativeEvent.actionName === "decrement")
              emit(Math.max(value - step, min));
          }}
        >
          <View style={[styles.track, { backgroundColor: c.border }]} />
          <Animated.View
            style={[styles.fill, { backgroundColor: c.primary }, fillStyle]}
          />
          {showTicks
            ? Array.from({ length: steps + 1 }, (_, i) => {
                const left = R + (i / steps) * width - 2;
                const on = min + i * step <= value;
                return (
                  <View
                    key={i}
                    pointerEvents="none"
                    style={[
                      styles.tick,
                      { left, backgroundColor: on ? c.primary : c.border },
                    ]}
                  />
                );
              })
            : null}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              { backgroundColor: c.primary, borderColor: c.surface },
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>
      {rightLabel ? <View style={styles.side}>{rightLabel}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  side: { paddingHorizontal: 6 },
  area: { flex: 1, height: 40, justifyContent: "center" },
  track: {
    position: "absolute",
    left: R,
    right: R,
    height: 3,
    borderRadius: 1.5,
  },
  fill: { position: "absolute", left: R, height: 3, borderRadius: 1.5 },
  tick: { position: "absolute", width: 4, height: 4, borderRadius: 2, top: 18 },
  thumb: {
    position: "absolute",
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: R,
    borderWidth: 2,
  },
});
