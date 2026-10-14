/**
 * Avtomatik media yuklash (bitta tarmoq turi uchun): umumiy kalit, rasmlar,
 * videolar va fayllar (hajm chegarasi bilan). prefs.autoDownload[network] ga yoziladi.
 */
import React from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { useUIStore, type AutoDownloadRule } from '@/stores/ui.store';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showActionSheet } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<SettingsStackParamList, 'AutoDownload'>;

const VIDEO_LIMITS = [1, 5, 10, 15, 50, 100];
const FILE_LIMITS = [1, 3, 5, 10, 50, 100];

export function AutoDownloadScreen({ navigation, route }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const net = route.params.network;
  const all = useUIStore((s) => s.autoDownload);
  const setPrefs = useUIStore((s) => s.setPrefs);
  const rule = all[net];

  const update = (patch: Partial<AutoDownloadRule>) =>
    setPrefs({ autoDownload: { ...all, [net]: { ...rule, ...patch } } });

  const pickLimit = (kind: 'video' | 'file') => {
    const list = kind === 'video' ? VIDEO_LIMITS : FILE_LIMITS;
    const current = kind === 'video' ? rule.videoMaxMb : rule.fileMaxMb;
    showActionSheet({
      title: t('data.auto.maxSize'),
      options: list.map((mb) => ({
        text: t('data.auto.upTo', { size: `${mb} MB` }),
        icon: mb === current ? 'checkmark' : undefined,
        onPress: () => update(kind === 'video' ? { videoMaxMb: mb, videos: true } : { fileMaxMb: mb, files: true }),
      })),
    });
  };

  const title =
    net === 'wifi' ? t('data.auto.wifi') : net === 'roaming' ? t('data.auto.roaming') : t('data.auto.mobile');

  const sw = (value: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ true: c.primary, false: c.border }}
      thumbColor="#FFFFFF"
      style={{ marginLeft: 8 }}
    />
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SettingsCard>
          <SettingsRow
            icon="download"
            color="#3E9BEA"
            label={t('data.auto.master')}
            onPress={() => update({ enabled: !rule.enabled })}
            right={sw(rule.enabled, (v) => update({ enabled: v }))}
            last
          />
        </SettingsCard>

        <View style={{ opacity: rule.enabled ? 1 : 0.5 }} pointerEvents={rule.enabled ? 'auto' : 'none'}>
          <SettingsCard title={t('data.auto.typesSection')} footer={t('data.auto.footer')}>
            <SettingsRow
              icon="image"
              color="#3E9BEA"
              label={t('data.auto.photos')}
              onPress={() => update({ photos: !rule.photos })}
              right={sw(rule.photos, (v) => update({ photos: v }))}
            />
            <SettingsRow
              icon="videocam"
              color="#8D6BDC"
              label={t('data.auto.videos')}
              subtitle={rule.videos ? t('data.auto.upTo', { size: `${rule.videoMaxMb} MB` }) : t('data.auto.off')}
              onPress={() => pickLimit('video')}
              right={sw(rule.videos, (v) => update({ videos: v }))}
            />
            <SettingsRow
              icon="document"
              color="#4FBC6B"
              label={t('data.auto.files')}
              subtitle={rule.files ? t('data.auto.upTo', { size: `${rule.fileMaxMb} MB` }) : t('data.auto.off')}
              onPress={() => pickLimit('file')}
              right={sw(rule.files, (v) => update({ files: v }))}
              last
            />
          </SettingsCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
