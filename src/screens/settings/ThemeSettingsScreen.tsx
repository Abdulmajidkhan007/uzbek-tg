/**
 * Eski "Mavzu" ekrani: endi barcha ko'rinish sozlamalari Chat sozlamalarida.
 * Ro'yxatda qolgan (eski havolalar uchun) — darhol o'sha ekranga o'tkazadi.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { SettingsStackParamList } from '@/navigation/types';
import { useTheme } from '@/hooks/useTheme';

type Props = StackScreenProps<SettingsStackParamList, 'ThemeSettings'>;

export function ThemeSettingsScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  useEffect(() => {
    navigation.replace('ChatSettings');
  }, [navigation]);
  return <View style={{ flex: 1, backgroundColor: c.background }} />;
}
