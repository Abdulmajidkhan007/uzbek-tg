import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  SectionList,
  SectionListData,
  SectionListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from '@/utils/haptics';

import { useTheme } from '@/hooks/useTheme';
import Avatar from '@/components/common/Avatar';
import EmptyState from '@/components/common/EmptyState';
import Divider from '@/components/ui/Divider';
import { chatName, openPrivateChat, searchChats, searchMessages } from '@/services/tdlib/chats';
import { useChatStore } from '@/stores/chat.store';
import type { ChatStackParamList } from '@/navigation/types';
import type { UserPreview, Chat, ChatMessage } from '@/stores/chat.store';

type NavProp = StackNavigationProp<ChatStackParamList>;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------
interface PeopleResult {
  kind: 'people';
  user: UserPreview;
}

interface ChatResult {
  kind: 'chat';
  chat: Chat;
}

interface MessageResult {
  kind: 'message';
  message: ChatMessage;
  chatName: string;
}

type SearchResult = PeopleResult | ChatResult | MessageResult;

interface ResultSection {
  title: string;
  data: SearchResult[];
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------
const SkeletonRow = React.memo(function SkeletonRow({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[skeletonStyles.row, { paddingHorizontal: theme.spacing.lg }]}>
      <View
        style={[
          skeletonStyles.avatar,
          { backgroundColor: theme.colors.surfaceElevated, borderRadius: theme.radius.full },
        ]}
      />
      <View style={skeletonStyles.lines}>
        <View
          style={[
            skeletonStyles.lineTop,
            { backgroundColor: theme.colors.surfaceElevated, borderRadius: theme.radius.xs },
          ]}
        />
        <View
          style={[
            skeletonStyles.lineBottom,
            { backgroundColor: theme.colors.surfaceElevated, borderRadius: theme.radius.xs },
          ]}
        />
      </View>
    </View>
  );
});

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  avatar: { width: 44, height: 44 },
  lines: { flex: 1, gap: 8 },
  lineTop: { height: 14, width: '60%' },
  lineBottom: { height: 11, width: '80%' },
});

// ---------------------------------------------------------------------------
// Recent search chip
// ---------------------------------------------------------------------------
const RecentChip = React.memo(function RecentChip({
  label,
  onPress,
  onRemove,
  theme,
}: {
  label: string;
  onPress: () => void;
  onRemove: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={[
        chipStyles.chip,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderRadius: theme.radius.full,
        },
      ]}
    >
      <Pressable onPress={onPress} style={chipStyles.labelArea} accessibilityRole="button">
        <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
        <Text
          style={[chipStyles.label, { color: theme.colors.text, fontSize: theme.fontSizes.sm }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
      <Pressable
        onPress={onRemove}
        style={chipStyles.removeBtn}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label} from recent searches`}
        hitSlop={8}
      >
        <Ionicons name="close" size={14} color={theme.colors.textSecondary} />
      </Pressable>
    </View>
  );
});

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 7,
    gap: 6,
  },
  labelArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  label: { flexShrink: 1 },
  removeBtn: {
    padding: 2,
  },
});

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------
const ResultRow = React.memo(function ResultRow({
  result,
  onPress,
  theme,
}: {
  result: SearchResult;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  let name = '';
  let subtitle = '';
  let avatarUri: string | undefined;
  let avatarName = '';

  if (result.kind === 'people') {
    name = `${result.user.firstName}${result.user.lastName ? ` ${result.user.lastName}` : ''}`;
    subtitle = result.user.username ?? '';
    avatarUri = result.user.avatarUrl;
    avatarName = name;
  } else if (result.kind === 'chat') {
    name = result.chat.name;
    subtitle =
      result.chat.type === 'group' || result.chat.type === 'channel' || result.chat.type === 'topic_group'
        ? `${result.chat.memberCount ?? 0} members`
        : result.chat.otherUser?.username ?? '';
    avatarUri = result.chat.avatarUrl;
    avatarName = result.chat.name;
  } else {
    name = result.chatName;
    subtitle = result.message.text ?? '[Media]';
    avatarUri = result.message.senderPreview.avatarUrl;
    avatarName = `${result.message.senderPreview.firstName}${result.message.senderPreview.lastName ? ` ${result.message.senderPreview.lastName}` : ''}`;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        rowStyles.row,
        { paddingHorizontal: theme.spacing.lg, backgroundColor: pressed ? theme.colors.surfaceHighlight : 'transparent' },
      ]}
      accessibilityRole="button"
    >
      <Avatar uri={avatarUri} name={avatarName} size={44} />
      <View style={rowStyles.textArea}>
        <Text
          style={[rowStyles.name, { color: theme.colors.text, fontSize: theme.fontSizes.md, fontWeight: theme.fontWeights.semibold }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        {subtitle.length > 0 && (
          <Text
            style={[rowStyles.subtitle, { color: theme.colors.textSecondary, fontSize: theme.fontSizes.sm }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  textArea: { flex: 1 },
  name: {},
  subtitle: { marginTop: 2 },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function SearchScreen(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'Sofia',
    'Design Team',
    'Tech News',
  ]);

  // Focus input when tab becomes active
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Debounce search with 50ms simulated delay
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    if (query.length < 2) {
      setDebouncedQuery('');
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsSearching(false);
    }, 50);
    return () => clearTimeout(timer);
  }, [query]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    inputRef.current?.focus();
  }, []);

  const addToRecent = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== term);
      return [term, ...filtered].slice(0, 5);
    });
  }, []);

  const handleRemoveRecent = useCallback((term: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRecentSearches((prev) => prev.filter((s) => s !== term));
  }, []);

  const handleRecentPress = useCallback(
    (term: string) => {
      setQuery(term);
      inputRef.current?.blur();
    },
    [],
  );

  const handleResultPress = useCallback(
    (result: SearchResult) => {
      if (result.kind === 'people') {
        const fullName = `${result.user.firstName}${result.user.lastName ? ` ${result.user.lastName}` : ''}`;
        addToRecent(fullName);
        openPrivateChat(result.user.id)
          .then((chat) =>
            navigation.navigate('ChatDetail', {
              chatId: chat.id,
              chatType: chat.type,
              title: chat.name,
              avatarUrl: chat.avatarUrl,
            }),
          )
          .catch(() => undefined);
      } else if (result.kind === 'chat') {
        addToRecent(result.chat.name);
        navigation.navigate('ChatDetail', {
          chatId: result.chat.id,
          chatType: result.chat.type,
          title: result.chat.name,
          avatarUrl: result.chat.avatarUrl,
        });
      } else {
        addToRecent(result.chatName);
        const chat = useChatStore.getState().chats.find((c) => c.id === result.message.chatId);
        navigation.navigate('ChatDetail', {
          chatId: result.message.chatId,
          chatType: chat?.type ?? 'group',
          title: chat?.name ?? result.chatName,
          avatarUrl: chat?.avatarUrl,
        });
      }
    },
    [navigation, addToRecent],
  );

  const [sections, setSections] = useState<ResultSection[]>([]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSections([]);
      return;
    }
    let cancelled = false;
    // Telegram qidiruvi: chatlar/kanallar (lokal + ommaviy) va xabarlar.
    Promise.all([searchChats(debouncedQuery), searchMessages(debouncedQuery)]).then(
      ([foundChats, foundMessages]) => {
        if (cancelled) return;
        const people: SearchResult[] = foundChats
          .filter((c) => c.type === 'private' && c.otherUser)
          .map((c) => ({ kind: 'people' as const, user: c.otherUser! }));
        const chatResults: SearchResult[] = foundChats
          .filter((c) => c.type !== 'private')
          .map((c) => ({ kind: 'chat' as const, chat: c }));
        const messages: SearchResult[] = foundMessages.map((m) => ({
          kind: 'message' as const,
          message: m,
          chatName: chatName(m.chatId) || "Noma'lum",
        }));
        const result: ResultSection[] = [];
        if (people.length > 0) result.push({ title: 'Odamlar', data: people });
        if (chatResults.length > 0) result.push({ title: 'Chatlar', data: chatResults });
        if (messages.length > 0) result.push({ title: 'Xabarlar', data: messages });
        setSections(result);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const hasQuery = query.length >= 2;
  const hasResults = sections.some((s) => s.data.length > 0);

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<SearchResult, ResultSection> }) => (
      <View
        style={[
          sectionStyles.header,
          { backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.lg },
        ]}
      >
        <Text
          style={[
            sectionStyles.headerText,
            { color: theme.colors.primary, fontSize: theme.fontSizes.sm, fontWeight: theme.fontWeights.semibold },
          ]}
        >
          {section.title}
        </Text>
      </View>
    ),
    [theme],
  );

  const renderItem: SectionListRenderItem<SearchResult, ResultSection> = useCallback(
    ({ item }) => (
      <ResultRow result={item} onPress={() => handleResultPress(item)} theme={theme} />
    ),
    [theme, handleResultPress],
  );

  const renderSectionSeparator = useCallback(() => <Divider inset={68} />, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
        },
        header: {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
        },
        title: {
          fontSize: theme.fontSizes.xxl,
          fontWeight: theme.fontWeights.bold,
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
        },
        searchBar: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surfaceElevated,
          borderRadius: theme.radius.xl,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          gap: theme.spacing.sm,
        },
        searchInput: {
          flex: 1,
          fontSize: theme.fontSizes.md,
          color: theme.colors.text,
          paddingVertical: 0,
        },
        clearBtn: {
          padding: 2,
        },
        recentSection: {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
        },
        recentTitle: {
          fontSize: theme.fontSizes.sm,
          fontWeight: theme.fontWeights.semibold,
          color: theme.colors.textSecondary,
          marginBottom: theme.spacing.md,
          textTransform: 'uppercase',
          letterSpacing: theme.letterSpacing.wide,
        },
        chipsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        skeletons: {
          paddingTop: theme.spacing.md,
        },
        listContent: {
          paddingBottom: insets.bottom + theme.spacing.xxl,
        },
        emptyContainer: {
          flex: 1,
          paddingTop: theme.spacing.massive,
        },
      }),
    [theme, insets],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search messages, people, groups..."
            placeholderTextColor={theme.colors.textTertiary}
            returnKeyType="search"
            clearButtonMode="never"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search input"
          />
          {query.length > 0 && (
            <Pressable
              style={styles.clearBtn}
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Body */}
      {!hasQuery && (
        <View style={styles.recentSection}>
          {recentSearches.length > 0 && (
            <>
              <Text style={styles.recentTitle}>Recent</Text>
              <View style={styles.chipsRow}>
                {recentSearches.map((term) => (
                  <RecentChip
                    key={term}
                    label={term}
                    onPress={() => handleRecentPress(term)}
                    onRemove={() => handleRemoveRecent(term)}
                    theme={theme}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {hasQuery && isSearching && (
        <View style={styles.skeletons}>
          <SkeletonRow theme={theme} />
          <SkeletonRow theme={theme} />
          <SkeletonRow theme={theme} />
        </View>
      )}

      {hasQuery && !isSearching && !hasResults && (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="🔍"
            title="No results found"
            subtitle={`Nothing matched "${query}". Try different keywords.`}
          />
        </View>
      )}

      {hasQuery && !isSearching && hasResults && (
        <SectionList<SearchResult, ResultSection>
          sections={sections}
          keyExtractor={(item, index) => {
            if (item.kind === 'people') return `people-${item.user.id}`;
            if (item.kind === 'chat') return `chat-${item.chat.id}`;
            return `msg-${item.message.id}-${index}`;
          }}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          SectionSeparatorComponent={renderSectionSeparator}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  header: {
    paddingVertical: 10,
  },
  headerText: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
