/**
 * Kontaktlar (Telegram uslubi): TDLib getContacts ro'yxati, harf bo'yicha
 * bo'limlar, qidiruv va har bir kontaktning haqiqiy "oxirgi marta" holati
 * (userStatus* — updateUserStatus orqali jonli yangilanadi).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  type SectionListData,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format, isToday, isYesterday } from 'date-fns';
import * as Haptics from '@/utils/haptics';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { useTheme } from '@/hooks/useTheme';
import { useT, type Translator } from '@/i18n';
import Avatar from '@/components/common/Avatar';
import EmptyState from '@/components/common/EmptyState';
import { loadContacts, openPrivateChat } from '@/services/tdlib/chats';
import { onTdUpdate, td } from '@/services/tdlib/client';
import type { TdObject, TdUser } from '@/services/tdlib/types';
import type { MainTabParamList } from '@/navigation/types';
import type { UserPreview } from '@/stores/chat.store';

type NavProp = BottomTabNavigationProp<MainTabParamList>;

/** TDLib userStatus* (faqat kerakli maydonlar). */
interface TdStatus {
  '@type': string;
  was_online?: number;
}

interface ContactSection {
  letter: string;
  data: UserPreview[];
}

function fullName(u: UserPreview): string {
  return `${u.firstName}${u.lastName ? ` ${u.lastName}` : ''}`;
}

function toSections(list: UserPreview[]): ContactSection[] {
  const map = new Map<string, UserPreview[]>();
  for (const c of list) {
    const letter = (c.firstName.charAt(0) || '#').toUpperCase();
    map.set(letter, [...(map.get(letter) ?? []), c]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([letter, data]) => ({ letter, data }));
}

/** Telegram'dagi kabi "oxirgi marta" matni. */
export function statusText(t: Translator, s: TdStatus | undefined, isBot?: boolean): string {
  if (isBot) return t('main.status.bot');
  switch (s?.['@type']) {
    case 'userStatusOnline':
      return t('common.online');
    case 'userStatusRecently':
      return t('main.status.recently');
    case 'userStatusLastWeek':
      return t('main.status.withinWeek');
    case 'userStatusLastMonth':
      return t('main.status.withinMonth');
    case 'userStatusOffline': {
      if (!s.was_online) return t('main.status.longAgo');
      const d = new Date(s.was_online * 1000);
      const time = format(d, 'HH:mm');
      if (isToday(d)) return t('main.status.at', { time });
      if (isYesterday(d)) return t('main.status.yesterdayAt', { time });
      return t('main.status.date', { date: format(d, 'dd.MM.yy') });
    }
    default:
      return t('main.status.longAgo');
  }
}

// ---------------------------------------------------------------------------
// Qator
// ---------------------------------------------------------------------------

const ContactRow = React.memo(function ContactRow({
  contact,
  status,
  isBot,
  onPress,
}: {
  contact: UserPreview;
  status?: TdStatus;
  isBot?: boolean;
  onPress: (contact: UserPreview) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const t = useT();
  const name = fullName(contact);
  const online = status?.['@type'] === 'userStatusOnline';
  return (
    <Pressable
      onPress={() => onPress(contact)}
      android_ripple={{ color: c.surfaceHighlight }}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <Avatar uri={contact.avatarUrl} name={name} size={46} showOnline isOnline={online} />
      <View style={[styles.rowBody, { borderBottomColor: c.border }]}>
        <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.status, { color: online ? c.primary : c.textSecondary }]} numberOfLines={1}>
          {status || isBot ? statusText(t, status, isBot) : ' '}
        </Text>
      </View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Ekran
// ---------------------------------------------------------------------------

export function ContactsScreen(): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const t = useT();
  const navigation = useNavigation<NavProp>();
  const listBg = theme.isDark ? c.background : c.surface;

  const listRef = useRef<SectionList<UserPreview, ContactSection>>(null);
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [contacts, setContacts] = useState<UserPreview[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, TdStatus>>({});
  const [bots, setBots] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    loadContacts()
      .then(async (list) => {
        if (!alive) return;
        setContacts(list);
        // Aniq holat (was_online, last week/month) — TDLib keshidan.
        const st: Record<string, TdStatus> = {};
        const bt: Record<string, boolean> = {};
        await Promise.all(
          list.map((u) =>
            td<TdUser & TdObject>({ '@type': 'getUser', user_id: Number(u.id) })
              .then((full) => {
                st[u.id] = full.status as TdStatus;
                if (full.type['@type'] === 'userTypeBot') bt[u.id] = true;
              })
              .catch(() => undefined),
          ),
        );
        if (!alive) return;
        setStatuses((prev) => ({ ...st, ...prev }));
        setBots(bt);
      })
      .catch(() => alive && setContacts([]));
    const off = onTdUpdate((u) => {
      if (u['@type'] !== 'updateUserStatus') return;
      const id = String(u.user_id);
      setStatuses((prev) => ({ ...prev, [id]: u.status as TdStatus }));
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const sections = useMemo(() => toSections(contacts ?? []), [contacts]);

  const filtered = useMemo<ContactSection[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        data: s.data.filter(
          (u) => fullName(u).toLowerCase().includes(q) || (u.username ?? '').toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.data.length > 0);
  }, [query, sections]);

  const toggleSearch = useCallback(() => {
    if (searchOpen) {
      setSearchOpen(false);
      setQuery('');
    } else {
      setSearchOpen(true);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [searchOpen]);

  const handlePress = useCallback(
    (contact: UserPreview) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      openPrivateChat(contact.id)
        .then((chat) =>
          navigation.navigate('ChatsTab', {
            screen: 'ChatDetail',
            initial: false,
            params: { chatId: chat.id, chatType: chat.type, title: chat.name, avatarUrl: chat.avatarUrl },
          }),
        )
        .catch(() => undefined);
    },
    [navigation],
  );

  const jumpTo = useCallback(
    (letter: string) => {
      const sectionIndex = filtered.findIndex((s) => s.letter === letter);
      if (sectionIndex >= 0) {
        Haptics.selectionAsync();
        listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, animated: true, viewOffset: 0 });
      }
    },
    [filtered],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<UserPreview, ContactSection> }) => (
      <View style={[styles.sectionHeader, { backgroundColor: listBg }]}>
        <Text style={[styles.sectionLetter, { color: c.primary }]}>{section.letter}</Text>
      </View>
    ),
    [c.primary, listBg],
  );

  const noResults = query.trim().length > 0 && filtered.length === 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: listBg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: c.surface }, !theme.isDark && styles.headerLight]}>
        {searchOpen ? (
          <>
            <TouchableOpacity onPress={toggleSearch} style={styles.headerBtn} accessibilityLabel={t('common.back')}>
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder={t('main.contacts.search')}
              placeholderTextColor={c.textTertiary}
              style={[styles.input, { color: c.text }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.headerBtn} accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={22} color={c.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
              {t('tabs.contacts')}
            </Text>
            <TouchableOpacity onPress={toggleSearch} style={styles.headerBtn} accessibilityLabel={t('common.search')}>
              <Ionicons name="search" size={23} color={c.text} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {contacts === null ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={c.primary} />
      ) : noResults ? (
        <EmptyState
          icon="👤"
          title={t('main.contacts.notFound')}
          subtitle={t('main.contacts.notFoundSub', { q: query.trim() })}
        />
      ) : contacts.length === 0 ? (
        <EmptyState icon="👥" title={t('main.contacts.empty')} subtitle={t('main.contacts.emptySub')} />
      ) : (
        <View style={{ flex: 1 }}>
          <SectionList<UserPreview, ContactSection>
            ref={listRef}
            sections={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ContactRow contact={item} status={statuses[item.id]} isBot={bots[item.id]} onPress={handlePress} />
            )}
            renderSectionHeader={renderSectionHeader}
            extraData={[statuses, bots, t.lang]}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 110 }}
            keyboardShouldPersistTaps="handled"
            onScrollToIndexFailed={() => undefined}
          />
          {query.trim().length === 0 && sections.length > 1 ? (
            <View style={styles.index} pointerEvents="box-none">
              {sections.map((s) => (
                <TouchableOpacity key={s.letter} onPress={() => jumpTo(s.letter)} hitSlop={{ left: 8, right: 8 }}>
                  <Text style={[styles.indexLetter, { color: c.primary }]}>{s.letter}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  headerLight: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  title: { flex: 1, fontSize: 21, fontWeight: '700' },
  headerBtn: { padding: 6 },
  input: { flex: 1, fontSize: 18, marginLeft: 12, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, height: 64 },
  rowBody: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    marginLeft: 14,
    paddingRight: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 16.5, fontWeight: '500' },
  status: { fontSize: 14, marginTop: 2 },
  sectionHeader: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 4 },
  sectionLetter: { fontSize: 15, fontWeight: '700' },
  index: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  indexLetter: { fontSize: 11.5, fontWeight: '600', lineHeight: 15 },
});
