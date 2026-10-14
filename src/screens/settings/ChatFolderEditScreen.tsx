/**
 * Papka yaratish / tahrirlash (Telegram'dagi "New Folder" / "Edit Folder"):
 * nom (1-12 belgi), kiritilgan chatlar va chat turlari, chiqarib tashlanganlar
 * (ovozsiz, o'qilgan, arxivdagi + aniq chatlar). createChatFolder / editChatFolder.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { useChatStore } from '@/stores/chat.store';
import {
  createChatFolder,
  deleteChatFolder,
  editChatFolder,
  emptyFolder,
  folderNameObject,
  getChatFolder,
  getChatTitle,
  type TdChatFolder,
} from '@/services/tdlib/folders';
import Avatar from '@/components/common/Avatar';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showAlert } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<SettingsStackParamList, 'ChatFolderEdit'>;

const MAX_NAME = 12;

type IncludeFlag = 'include_contacts' | 'include_non_contacts' | 'include_groups' | 'include_channels' | 'include_bots';
type ExcludeFlag = 'exclude_muted' | 'exclude_read' | 'exclude_archived';
type Flag = IncludeFlag | ExcludeFlag;

const INCLUDE_TYPES: { flag: IncludeFlag; key: string; icon: string; color: string }[] = [
  { flag: 'include_contacts', key: 'data.folders.typeContacts', icon: 'person', color: '#3E9BEA' },
  { flag: 'include_non_contacts', key: 'data.folders.typeNonContacts', icon: 'person-outline', color: '#2CB9B0' },
  { flag: 'include_groups', key: 'data.folders.typeGroups', icon: 'people', color: '#4FBC6B' },
  { flag: 'include_channels', key: 'data.folders.typeChannels', icon: 'megaphone', color: '#F2A23A' },
  { flag: 'include_bots', key: 'data.folders.typeBots', icon: 'hardware-chip', color: '#8D6BDC' },
];

const EXCLUDE_TYPES: { flag: ExcludeFlag; key: string; icon: string; color: string }[] = [
  { flag: 'exclude_muted', key: 'data.folders.typeMuted', icon: 'notifications-off', color: '#E9546B' },
  { flag: 'exclude_read', key: 'data.folders.typeRead', icon: 'checkmark-done', color: '#4FBC6B' },
  { flag: 'exclude_archived', key: 'data.folders.typeArchived', icon: 'archive', color: '#F2A23A' },
];

type PickerMode = 'include' | 'exclude' | null;

export function ChatFolderEditScreen({ navigation, route }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const folderId = route.params?.folderId;
  const isEdit = typeof folderId === 'number';
  const storeChats = useChatStore((s) => s.chats);

  const [original, setOriginal] = useState<TdChatFolder | null>(isEdit ? null : emptyFolder());
  const [name, setName] = useState('');
  const [flags, setFlags] = useState<Record<Flag, boolean>>({
    include_contacts: false,
    include_non_contacts: false,
    include_groups: false,
    include_channels: false,
    include_bots: false,
    exclude_muted: false,
    exclude_read: false,
    exclude_archived: false,
  });
  const [included, setIncluded] = useState<number[]>([]);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<PickerMode>(null);
  const [saving, setSaving] = useState(false);

  // Mavjud papkani yuklash.
  useEffect(() => {
    if (!isEdit) return;
    getChatFolder(folderId)
      .then((f) => {
        setOriginal(f);
        setName(f.name.text.text);
        setFlags({
          include_contacts: f.include_contacts,
          include_non_contacts: f.include_non_contacts,
          include_groups: f.include_groups,
          include_channels: f.include_channels,
          include_bots: f.include_bots,
          exclude_muted: f.exclude_muted,
          exclude_read: f.exclude_read,
          exclude_archived: f.exclude_archived,
        });
        setIncluded([...new Set([...f.pinned_chat_ids, ...f.included_chat_ids])]);
        setExcluded(f.excluded_chat_ids);
      })
      .catch((e: Error) => {
        showAlert(t('common.error'), e.message);
        navigation.goBack();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const storeMap = useMemo(() => new Map(storeChats.map((x) => [x.id, x])), [storeChats]);

  // Store'da yo'q chatlar nomini getChat orqali olish.
  useEffect(() => {
    const missing = [...included, ...excluded]
      .map(String)
      .filter((id) => !storeMap.has(id) && names[id] === undefined);
    if (missing.length === 0) return;
    void Promise.all(
      missing.map((id) =>
        getChatTitle(Number(id)).then(
          (title) => [id, title] as const,
          () => [id, ''] as const,
        ),
      ),
    ).then((pairs) => setNames((prev) => ({ ...prev, ...Object.fromEntries(pairs) })));
  }, [included, excluded, storeMap, names]);

  const chatName = (id: number) => storeMap.get(String(id))?.name || names[String(id)] || t('data.storage.unknownChat');

  const save = () => {
    if (!original) return;
    const text = name.trim();
    if (!text) return showAlert(t('common.error'), t('data.folders.errName'));
    const hasInclude = included.length > 0 || INCLUDE_TYPES.some((x) => flags[x.flag]);
    if (!hasInclude) return showAlert(t('common.error'), t('data.folders.errEmpty'));
    const sel = new Set(included);
    const pinned = original.pinned_chat_ids.filter((id) => sel.has(id));
    const pinnedSet = new Set(pinned);
    const folder: TdChatFolder = {
      ...original,
      // Nom o'zgarmagan bo'lsa — asl obyekt (custom emoji entity'lari saqlanadi).
      name: text === original.name.text.text ? original.name : folderNameObject(text),
      ...flags,
      pinned_chat_ids: pinned,
      included_chat_ids: included.filter((id) => !pinnedSet.has(id)),
      excluded_chat_ids: excluded.filter((id) => !sel.has(id)),
    };
    setSaving(true);
    (isEdit ? editChatFolder(folderId, folder) : createChatFolder(folder))
      .then(() => navigation.goBack())
      .catch((e: Error) => showAlert(t('common.error'), e.message))
      .finally(() => setSaving(false));
  };

  const remove = () => {
    if (!isEdit) return;
    showAlert(t('data.folders.deleteTitle'), t('data.folders.deleteConfirm', { name: name.trim() }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteChatFolder(folderId)
            .then(() => navigation.goBack())
            .catch((e: Error) => showAlert(t('common.error'), e.message));
        },
      },
    ]);
  };

  const removeIcon = (onPress: () => void) => (
    <Pressable onPress={onPress} hitSlop={10} style={{ marginLeft: 8 }}>
      <Ionicons name="close" size={20} color={c.textTertiary} />
    </Pressable>
  );

  const chatRow = (id: number, last: boolean, onRemove: () => void) => {
    const s = storeMap.get(String(id));
    const n = chatName(id);
    return (
      <View key={id} style={styles.chatRow}>
        <Avatar uri={s?.avatarUrl} name={n} size={34} />
        <View
          style={[
            styles.chatBody,
            !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <Text style={{ color: c.text, fontSize: 16, flex: 1 }} numberOfLines={1}>
            {n}
          </Text>
          {removeIcon(onRemove)}
        </View>
      </View>
    );
  };

  if (!original) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
        <ScreenHeader title={t('data.folders.editTitle')} onBack={() => navigation.goBack()} />
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
      </SafeAreaView>
    );
  }

  const incTypes = INCLUDE_TYPES.filter((x) => flags[x.flag]);
  const excTypes = EXCLUDE_TYPES.filter((x) => flags[x.flag]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader
        title={isEdit ? t('data.folders.editTitle') : t('data.folders.newTitle')}
        onBack={() => navigation.goBack()}
        right={
          <Pressable onPress={saving ? undefined : save} hitSlop={10} style={{ paddingLeft: 12 }}>
            {saving ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <Text style={{ color: c.primary, fontSize: 16, fontWeight: '700' }}>{t('common.save')}</Text>
            )}
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SettingsCard title={t('data.folders.nameSection')}>
          <View style={styles.nameRow}>
            <Ionicons name="folder" size={24} color="#F59B2B" style={{ marginRight: 14 }} />
            <TextInput
              value={name}
              onChangeText={(s) => setName(s.replace(/\n/g, ''))}
              maxLength={MAX_NAME}
              placeholder={t('data.folders.namePlaceholder')}
              placeholderTextColor={c.textTertiary}
              style={[styles.nameInput, { color: c.text }]}
            />
            <Text style={{ color: c.textTertiary, fontSize: 13 }}>{MAX_NAME - name.length}</Text>
          </View>
        </SettingsCard>

        <SettingsCard title={t('data.folders.included')} footer={t('data.folders.includedFooter')}>
          <Pressable
            onPress={() => setPicker('include')}
            android_ripple={{ color: c.surfaceHighlight }}
            style={styles.addRow}
          >
            <Ionicons name="add-circle" size={26} color={c.primary} style={{ marginRight: 18 }} />
            <Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>{t('data.folders.addChats')}</Text>
          </Pressable>
          {incTypes.map((x, i) => (
            <SettingsRow
              key={x.flag}
              icon={x.icon}
              color={x.color}
              label={t(x.key)}
              right={removeIcon(() => setFlags((f) => ({ ...f, [x.flag]: false })))}
              last={i === incTypes.length - 1 && included.length === 0}
            />
          ))}
          {included.map((id, i) =>
            chatRow(id, i === included.length - 1, () => setIncluded((l) => l.filter((x) => x !== id))),
          )}
        </SettingsCard>

        <SettingsCard title={t('data.folders.excluded')} footer={t('data.folders.excludedFooter')}>
          <Pressable
            onPress={() => setPicker('exclude')}
            android_ripple={{ color: c.surfaceHighlight }}
            style={styles.addRow}
          >
            <Ionicons name="remove-circle" size={26} color={c.primary} style={{ marginRight: 18 }} />
            <Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>{t('data.folders.removeChats')}</Text>
          </Pressable>
          {excTypes.map((x, i) => (
            <SettingsRow
              key={x.flag}
              icon={x.icon}
              color={x.color}
              label={t(x.key)}
              right={removeIcon(() => setFlags((f) => ({ ...f, [x.flag]: false })))}
              last={i === excTypes.length - 1 && excluded.length === 0}
            />
          ))}
          {excluded.map((id, i) =>
            chatRow(id, i === excluded.length - 1, () => setExcluded((l) => l.filter((x) => x !== id))),
          )}
        </SettingsCard>

        {isEdit ? (
          <SettingsCard>
            <SettingsRow icon="trash" label={t('data.folders.delete')} danger onPress={remove} last />
          </SettingsCard>
        ) : null}
      </ScrollView>

      {picker ? (
        <ChatPicker
          mode={picker}
          flags={flags}
          selected={picker === 'include' ? included : excluded}
          extraNames={names}
          onClose={() => setPicker(null)}
          onDone={(ids, newFlags) => {
            if (picker === 'include') {
              setIncluded(ids);
              setExcluded((l) => l.filter((x) => !ids.includes(x)));
            } else {
              setExcluded(ids);
              setIncluded((l) => l.filter((x) => !ids.includes(x)));
            }
            setFlags((f) => ({ ...f, ...newFlags }));
            setPicker(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Chat tanlash oynasi (turlar + chatlar, qidiruv)
// ---------------------------------------------------------------------------
function ChatPicker({
  mode,
  flags,
  selected,
  extraNames,
  onClose,
  onDone,
}: {
  mode: 'include' | 'exclude';
  flags: Record<Flag, boolean>;
  selected: number[];
  extraNames: Record<string, string>;
  onClose: () => void;
  onDone: (ids: number[], flags: Partial<Record<Flag, boolean>>) => void;
}): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const chats = useChatStore((s) => s.chats);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<Set<number>>(() => new Set(selected));
  const types = mode === 'include' ? INCLUDE_TYPES : EXCLUDE_TYPES;
  const [typeSel, setTypeSel] = useState<Partial<Record<Flag, boolean>>>(() => {
    const o: Partial<Record<Flag, boolean>> = {};
    for (const x of types) o[x.flag] = flags[x.flag];
    return o;
  });

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = chats.map((x) => ({ id: Number(x.id), name: x.name, avatarUrl: x.avatarUrl }));
    // Tanlangan, lekin store'da yo'q chatlar ham ko'rinsin.
    const known = new Set(base.map((x) => x.id));
    for (const id of selected) if (!known.has(id)) base.push({ id, name: extraNames[String(id)] ?? '', avatarUrl: undefined });
    return q ? base.filter((x) => x.name.toLowerCase().includes(q)) : base;
  }, [chats, query, selected, extraNames]);

  const toggle = (id: number) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const check = (on: boolean) => (
    <View style={[styles.check, { borderColor: on ? c.primary : c.textTertiary, backgroundColor: on ? c.primary : 'transparent' }]}>
      {on ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
    </View>
  );

  const header = (
    <View>
      <Text style={[styles.section, { color: c.primary }]}>{t('data.folders.chatTypes')}</Text>
      <View style={{ backgroundColor: c.surface }}>
        {types.map((x) => (
          <Pressable
            key={x.flag}
            onPress={() => setTypeSel((s) => ({ ...s, [x.flag]: !s[x.flag] }))}
            android_ripple={{ color: c.surfaceHighlight }}
            style={styles.pickRow}
          >
            <View style={[styles.typeIcon, { backgroundColor: x.color }]}>
              <Ionicons name={x.icon} size={18} color="#FFFFFF" />
            </View>
            <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{t(x.key)}</Text>
            {check(!!typeSel[x.flag])}
          </Pressable>
        ))}
      </View>
      <Text style={[styles.section, { color: c.primary }]}>{t('data.folders.chatsSection')}</Text>
    </View>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent={false}>
      <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <ScreenHeader
          title={mode === 'include' ? t('data.folders.included') : t('data.folders.excluded')}
          onBack={onClose}
          right={
            <Pressable onPress={() => onDone([...sel], typeSel)} hitSlop={10} style={{ paddingLeft: 12 }}>
              <Text style={{ color: c.primary, fontSize: 16, fontWeight: '700' }}>{t('common.done')}</Text>
            </Pressable>
          }
        />
        <View style={[styles.searchWrap, { backgroundColor: c.surface }]}>
          <Ionicons name="search" size={18} color={c.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('common.search')}
            placeholderTextColor={c.textTertiary}
            style={[styles.searchInput, { color: c.text }]}
          />
        </View>
        <FlatList
          data={list}
          keyExtractor={(x) => String(x.id)}
          ListHeaderComponent={query ? null : header}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => toggle(item.id)}
              android_ripple={{ color: c.surfaceHighlight }}
              style={[styles.pickRow, { backgroundColor: c.surface }]}
            >
              <Avatar uri={item.avatarUrl} name={item.name || '?'} size={40} />
              <Text style={{ color: c.text, fontSize: 16, flex: 1, marginLeft: 14 }} numberOfLines={1}>
                {item.name || t('data.storage.unknownChat')}
              </Text>
              {check(sel.has(item.id))}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 54 },
  nameInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, minHeight: 52 },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  chatBody: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 52, marginLeft: 16, paddingRight: 16 },
  section: { fontSize: 14.5, fontWeight: '600', marginLeft: 16, marginTop: 16, marginBottom: 6 },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 56 },
  typeIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 18 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8, marginLeft: 8 },
});
