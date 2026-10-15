/**
 * Hikoya halqali avatar: o'qilmagan — ko'k→yashil gradient halqa,
 * o'qilgan — kulrang ingichka halqa, hikoya yo'q — halqasiz.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Avatar from '@/components/common/Avatar';
import { useTheme } from '@/hooks/useTheme';

export type RingState = 'unread' | 'read' | 'none';

interface Props {
  uri?: string;
  name: string;
  /** Avatar diametri (halqasiz). */
  size: number;
  ring: RingState;
  /** Avatar va halqa orasidagi bo'shliq. */
  gap?: number;
  /** Halqa qalinligi. */
  stroke?: number;
  gradientId: string;
}

export const STORY_GRADIENT = ['#3EA0FF', '#2FD07E'] as const;

export default function StoryAvatar({ uri, name, size, ring, gap = 3, stroke = 2.4, gradientId }: Props): React.JSX.Element {
  const theme = useTheme();
  const outer = size + (gap + stroke) * 2;
  const r = (outer - stroke) / 2;
  const readStroke = Math.max(1.2, stroke - 1);
  return (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      {ring !== 'none' ? (
        <Svg width={outer} height={outer} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor={STORY_GRADIENT[0]} />
              <Stop offset="1" stopColor={STORY_GRADIENT[1]} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={outer / 2}
            cy={outer / 2}
            r={ring === 'unread' ? r : (outer - readStroke) / 2}
            stroke={ring === 'unread' ? `url(#${gradientId})` : theme.colors.textTertiary}
            strokeWidth={ring === 'unread' ? stroke : readStroke}
            fill="none"
          />
        </Svg>
      ) : null}
      <Avatar uri={uri} name={name || '?'} size={size} />
    </View>
  );
}
