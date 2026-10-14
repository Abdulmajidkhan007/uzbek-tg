/**
 * Telegram uslubidagi halqa (donut) diagramma: rangli bo'laklar, ular ustida
 * foizlar, markazda umumiy qiymat. react-native-svg bilan chiziladi.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';

export interface DonutSegment {
  key: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSubLabel?: string;
  /** Bo'laklar ustida foizlarni ko'rsatish. */
  showPercents?: boolean;
}

function polar(cx: number, cy: number, r: number, a: number): { x: number; y: number } {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

export function percentLabel(fraction: number): string {
  const p = fraction * 100;
  if (p > 0 && p < 1) return '<1%';
  return `${Math.round(p)}%`;
}

export function DonutChart({
  segments,
  size = 200,
  thickness = 30,
  centerLabel,
  centerSubLabel,
  showPercents = true,
}: DonutChartProps): React.JSX.Element {
  const c = useTheme().colors;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const items = segments.filter((s) => s.value > 0);
  const total = items.reduce((a, s) => a + s.value, 0);
  // Bo'laklar orasidagi bo'shliq (radian).
  const gap = items.length > 1 ? 0.035 : 0;

  let angle = -Math.PI / 2;
  const arcs = items.map((s) => {
    const frac = s.value / total;
    const sweep = frac * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + sweep;
    angle = a1;
    return { s, frac, a0, a1 };
  });

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        {total <= 0 ? (
          <Circle cx={cx} cy={cy} r={r} stroke={c.surfaceHighlight} strokeWidth={thickness} fill="none" />
        ) : items.length === 1 ? (
          <Circle cx={cx} cy={cy} r={r} stroke={items[0]!.color} strokeWidth={thickness} fill="none" />
        ) : (
          arcs.map(({ s, a0, a1 }) => {
            const start = a0 + gap / 2;
            const end = Math.max(start + 0.004, a1 - gap / 2);
            return (
              <Path
                key={s.key}
                d={arcPath(cx, cy, r, start, end)}
                stroke={s.color}
                strokeWidth={thickness}
                strokeLinecap="butt"
                fill="none"
              />
            );
          })
        )}
        {showPercents && total > 0
          ? arcs
              .filter((a) => a.frac >= 0.06)
              .map(({ s, frac, a0, a1 }) => {
                const p = polar(cx, cy, r, (a0 + a1) / 2);
                return (
                  <SvgText
                    key={`t-${s.key}`}
                    x={p.x}
                    y={p.y + 4}
                    fill="#FFFFFF"
                    fontSize={11}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {percentLabel(frac)}
                  </SvgText>
                );
              })
          : null}
      </Svg>
      {centerLabel ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <Text style={[styles.label, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {centerLabel}
          </Text>
          {centerSubLabel ? (
            <Text style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>
              {centerSubLabel}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 44 },
  label: { fontSize: 24, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 2 },
});

export default DonutChart;
