/**
 * Proksi sozlamalari: "Proksidan foydalanish" kaliti, saqlangan proksilar
 * (getProxies) va ularning holati (pingProxy), yangi proksi qo'shish
 * (qo'lda yoki t.me/proxy / tg://socks havolasi orqali).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import {
  addProxy,
  disableProxy,
  enableProxy,
  getProxies,
  makeProxy,
  pingProxy,
  proxyKind,
  proxyKindLabel,
  removeProxy,
  resolveProxyLink,
  type ProxyKind,
  type TdAddedProxy,
} from '@/services/tdlib/proxy';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showActionSheet, showAlert } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<SettingsStackParamList, 'Proxy'>;
type Ping = { state: 'checking' } | { state: 'ok'; ms: number } | { state: 'fail' };

export function ProxyScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const [list, setList] = useState<TdAddedProxy[] | null>(null);
  const [pings, setPings] = useState<Record<number, Ping>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<ProxyKind>('socks5');
  const [server, setServer] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState('');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);

  const fail = (e: Error) => showAlert(t('common.error'), e.message);

  const ping = useCallback((items: TdAddedProxy[]) => {
    setPings((p) => {
      const n = { ...p };
      for (const x of items) n[x.id] = { state: 'checking' };
      return n;
    });
    for (const x of items) {
      pingProxy(x.proxy).then(
        (ms) => setPings((p) => ({ ...p, [x.id]: { state: 'ok', ms } })),
        () => setPings((p) => ({ ...p, [x.id]: { state: 'fail' } })),
      );
    }
  }, []);

  const load = useCallback(
    (withPing = false) =>
      getProxies()
        .then((l) => {
          setList(l);
          if (withPing) ping(l);
        })
        .catch(() => setList([])),
    [ping],
  );
  useEffect(() => {
    void load(true);
  }, [load]);

  const enabled = list?.find((p) => p.is_enabled);

  const toggleUse = (v: boolean) => {
    if (!list) return;
    if (!v) {
      disableProxy().then(() => load()).catch(fail);
      return;
    }
    if (list.length === 0) {
      setFormOpen(true);
      return;
    }
    const last = [...list].sort((a, b) => b.last_used_date - a.last_used_date)[0]!;
    enableProxy(last.id).then(() => load()).catch(fail);
  };

  const openMenu = (p: TdAddedProxy) =>
    showActionSheet({
      title: `${p.proxy.server}:${p.proxy.port}`,
      options: [
        p.is_enabled
          ? { text: t('data.proxy.disconnect'), icon: 'close-circle', onPress: () => disableProxy().then(() => load()).catch(fail) }
          : { text: t('data.proxy.connect'), icon: 'checkmark-circle', onPress: () => enableProxy(p.id).then(() => load()).catch(fail) },
        { text: t('data.proxy.check'), icon: 'pulse', onPress: () => ping([p]) },
        {
          text: t('common.delete'),
          icon: 'trash',
          destructive: true,
          onPress: () =>
            showAlert(t('data.proxy.deleteTitle'), t('data.proxy.deleteConfirm'), [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => removeProxy(p.id).then(() => load()).catch(fail),
              },
            ]),
        },
      ],
    });

  const resetForm = () => {
    setServer('');
    setPort('');
    setUsername('');
    setPassword('');
    setSecret('');
    setLink('');
    setFormOpen(false);
  };

  const saveManual = () => {
    const portN = Number(port);
    if (!server.trim()) return showAlert(t('common.error'), t('data.proxy.errServer'));
    if (!Number.isInteger(portN) || portN <= 0 || portN > 65535) return showAlert(t('common.error'), t('data.proxy.errPort'));
    if (kind === 'mtproto' && !secret.trim()) return showAlert(t('common.error'), t('data.proxy.errSecret'));
    const proxy = makeProxy(kind, server, portN, { username, password, secret: secret.trim() });
    setSaving(true);
    addProxy(proxy, true)
      .then((added) => {
        resetForm();
        return load().then(() => ping([added]));
      })
      .catch(fail)
      .finally(() => setSaving(false));
  };

  const saveLink = () => {
    setSaving(true);
    resolveProxyLink(link)
      .then((proxy) => {
        if (!proxy) {
          showAlert(t('common.error'), t('data.proxy.errLink'));
          return;
        }
        return addProxy(proxy, true).then((added) => {
          resetForm();
          return load().then(() => ping([added]));
        });
      })
      .catch(fail)
      .finally(() => setSaving(false));
  };

  const statusText = (p: TdAddedProxy): { text: string; color: string } => {
    const s = pings[p.id];
    if (!s || s.state === 'checking') return { text: t('data.proxy.checking'), color: c.textSecondary };
    if (s.state === 'fail') return { text: t('data.proxy.unavailable'), color: c.error };
    return {
      text: p.is_enabled
        ? t('data.proxy.connected', { ms: s.ms })
        : t('data.proxy.available', { ms: s.ms }),
      color: c.success,
    };
  };

  const input = (
    value: string,
    onChange: (s: string) => void,
    placeholder: string,
    opts: { numeric?: boolean; secure?: boolean } = {},
  ) => (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.textTertiary}
      keyboardType={opts.numeric ? 'number-pad' : 'default'}
      secureTextEntry={opts.secure}
      autoCapitalize="none"
      autoCorrect={false}
      style={[styles.input, { color: c.text, borderBottomColor: c.border }]}
    />
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('data.proxy.settings')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SettingsCard footer={t('data.proxy.footer')}>
          <SettingsRow
            icon="shield-checkmark"
            color="#2CB9B0"
            label={t('data.proxy.use')}
            onPress={() => toggleUse(!enabled)}
            right={
              <Switch
                value={!!enabled}
                onValueChange={toggleUse}
                trackColor={{ true: c.primary, false: c.border }}
                thumbColor="#FFFFFF"
              />
            }
            last
          />
        </SettingsCard>

        <SettingsCard title={t('data.proxy.listTitle')}>
          {(list ?? []).map((p) => {
            const st = statusText(p);
            return (
              <Pressable
                key={p.id}
                onPress={() => (p.is_enabled ? openMenu(p) : enableProxy(p.id).then(() => load()).catch(fail))}
                onLongPress={() => openMenu(p)}
                android_ripple={{ color: c.surfaceHighlight }}
                style={styles.proxyRow}
              >
                <Ionicons
                  name={p.is_enabled ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={p.is_enabled ? c.primary : c.textTertiary}
                  style={{ marginRight: 16 }}
                />
                <View style={[styles.proxyBody, { borderBottomColor: c.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.proxyTitle, { color: c.text }]} numberOfLines={1}>
                      {`${p.proxy.server}:${p.proxy.port}`}
                    </Text>
                    <Text style={{ fontSize: 13.5, marginTop: 2 }} numberOfLines={1}>
                      <Text style={{ color: c.textSecondary }}>{`${proxyKindLabel(proxyKind(p.proxy))} · `}</Text>
                      <Text style={{ color: st.color }}>{st.text}</Text>
                    </Text>
                  </View>
                  <Pressable onPress={() => openMenu(p)} hitSlop={10}>
                    <Ionicons name="ellipsis-vertical" size={20} color={c.textSecondary} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
          <SettingsRow
            icon={formOpen ? 'close' : 'add'}
            color={formOpen ? c.textSecondary : c.primary}
            label={formOpen ? t('common.cancel') : t('data.proxy.add')}
            onPress={() => (formOpen ? resetForm() : setFormOpen(true))}
            last
          />
        </SettingsCard>

        {formOpen ? (
          <>
            <SettingsCard title={t('data.proxy.linkTitle')} footer={t('data.proxy.linkFooter')}>
              <View style={styles.form}>
                {input(link, setLink, 'https://t.me/proxy?server=…')}
                <Pressable
                  onPress={saving || !link.trim() ? undefined : saveLink}
                  style={[styles.btn, { backgroundColor: c.primary, opacity: saving || !link.trim() ? 0.5 : 1 }]}
                >
                  <Text style={styles.btnText}>{t('data.proxy.addFromLink')}</Text>
                </Pressable>
              </View>
            </SettingsCard>

            <SettingsCard title={t('data.proxy.manualTitle')}>
              <View style={styles.form}>
                <View style={[styles.segment, { backgroundColor: c.surfaceHighlight }]}>
                  {(['socks5', 'http', 'mtproto'] as ProxyKind[]).map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => setKind(k)}
                      style={[styles.segItem, kind === k && { backgroundColor: c.primary }]}
                    >
                      <Text style={{ color: kind === k ? '#FFFFFF' : c.text, fontWeight: '600' }}>{proxyKindLabel(k)}</Text>
                    </Pressable>
                  ))}
                </View>
                {input(server, setServer, t('data.proxy.server'))}
                {input(port, setPort, t('data.proxy.port'), { numeric: true })}
                {kind === 'mtproto' ? (
                  input(secret, setSecret, t('data.proxy.secret'))
                ) : (
                  <>
                    {input(username, setUsername, t('data.proxy.username'))}
                    {input(password, setPassword, t('data.proxy.password'), { secure: true })}
                  </>
                )}
                <Pressable
                  onPress={saving ? undefined : saveManual}
                  style={[styles.btn, { backgroundColor: c.primary, opacity: saving ? 0.5 : 1 }]}
                >
                  <Text style={styles.btnText}>{t('common.save')}</Text>
                </Pressable>
              </View>
            </SettingsCard>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  proxyRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, minHeight: 60 },
  proxyBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  proxyTitle: { fontSize: 16 },
  form: { paddingHorizontal: 16, paddingVertical: 12 },
  input: { fontSize: 16, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, marginBottom: 6 },
  btn: { height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 8 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
});
