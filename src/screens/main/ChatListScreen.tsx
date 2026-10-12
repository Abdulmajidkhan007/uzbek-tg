import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useChatStore } from '@/stores/chat.store';
import { loadMoreChats } from '@/services/tdlib/chats';
import type { Chat } from '@/stores/chat.store';
import type { ChatStackParamList } from '@/navigation/types';

import ChatListItem from '@/components/chat/ChatListItem';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<ChatStackParamList, 'ChatList'>;
type FilterType = 'all' | 'groups' | 'channels';

interface FilterChip {
  key: FilterType;
  label: string;
}

const FILTER_CHIPS: FilterChip[] = [
  { key: 'all', label: 'All' },
  { key: 'groups', label: 'Groups' },
  { key: 'channels', label: 'Channels' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
interface FilterChipItemProps {
  chip: FilterChip;
  isActive: boolean;
  onPress: (key: FilterType) => void;
}

const FilterChipItem = React.memo(function FilterChipItem({
  chip,
  isActive,
  onPress,
}: FilterChipItemProps) {
  const theme = useTheme();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(chip.key);
  }, [chip.key, onPress]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[
        styles.filterChip,
        {
          backgroundColor: isActive ? theme.colors.primary : theme.colors.surfaceElevated,
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.xs + 2,
          marginRight: theme.spacing.sm,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${chip.label} filter`}
    >
      <Text
        style={[
          theme.textStyles.bodySmall,
          {
            color: isActive ? theme.colors.textInverse : theme.colors.textSecondary,
            fontWeight: isActive ? theme.fontWeights.semibold : theme.fontWeights.regular,
          },
        ]}
      >
        {chip.label}
      </Text>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export function ChatListScreen({ navigation }: Props) {
  const theme = useTheme();

  const chats = useChatStore((s) => s.chats);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const searchInputRef = useRef<TextInput>(null);

  // Animated values
  const searchBarHeight = useSharedValue(0);
  const searchBarOpacity = useSharedValue(0);
  const fabScale = useSharedValue(1);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  // Chatlar TDLib update'laridan useChatStore'ga keladi (services/tdlib/chats.ts).
  // Bu yerda faqat ro'yxatni davom ettirish va pull-to-refresh.
  const isLoading = useChatStore((s) => s.isLoadingChats);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadMoreChats();
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleEndReached = useCallback(() => {
    void loadMoreChats();
  }, []);

  // ---------------------------------------------------------------------------
  // Search toggle
  // ---------------------------------------------------------------------------
  const toggleSearch = useCallback(() => {
    const willOpen = !isSearchVisible;

    if (willOpen) {
      setIsSearchVisible(true);
      searchBarHeight.value = withSpring(52, { damping: 18, stiffness: 200 });
      searchBarOpacity.value = withTiming(1, { duration: 200 });
      setTimeout(() => searchInputRef.current?.focus(), 250);
    } else {
      searchBarOpacity.value = withTiming(0, { duration: 150 });
      searchBarHeight.value = withTiming(0, { duration: 200 });
      setTimeout(() => {
        setIsSearchVisible(false);
        setSearchQuery('');
      }, 210);
    }
  }, [isSearchVisible, searchBarHeight, searchBarOpacity]);

  const animatedSearchBar = useAnimatedStyle(() => ({
    height: searchBarHeight.value,
    opacity: searchBarOpacity.value,
    overflow: 'hidden',
  }));

  // ---------------------------------------------------------------------------
  // FAB
  // ---------------------------------------------------------------------------
  const handleFabPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fabScale.value = withSpring(0.85, {}, () => {
      fabScale.value = withSpring(1);
    });
    // Navigate to contacts to start a new chat — navigator wires this up
  }, [fabScale]);

  const animatedFab = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  const filteredChats = useMemo<Chat[]>(() => {
    let result = chats;

    if (activeFilter === 'groups') {
      result = result.filter((c) => c.type === 'group' || c.type === 'topic_group');
    } else if (activeFilter === 'channels') {
      result = result.filter((c) => c.type === 'channel');
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.lastMessage?.text ?? '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [chats, activeFilter, searchQuery]);

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------
  const handleChatPress = useCallback(
    (chatId: string) => {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('ChatDetail', {
        chatId: chat.id,
        chatType: chat.type,
        title: chat.name,
        avatarUrl: chat.avatarUrl,
      });
    },
    [chats, navigation]
  );

  const handleChatLongPress = useCallback((_chatId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Future: open context menu (pin, mute, archive, delete)
  }, []);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderItem = useCallback(
    ({ item }: { item: Chat }) => (
      <ChatListItem
        chat={item}
        onPress={handleChatPress}
        onLongPress={handleChatLongPress}
        currentUserId="me"
      />
    ),
    [handleChatPress, handleChatLongPress]
  );

  const keyExtractor = useCallback((item: Chat) => item.id, []);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <EmptyState
        icon="💬"
        title="No Chats Yet"
        subtitle={
          activeFilter !== 'all' || searchQuery.length > 0
            ? 'Try adjusting your filters or search term.'
            : 'Start a conversation by tapping the pencil icon.'
        }
      />
    );
  }, [isLoading, activeFilter, searchQuery]);

  const renderListHeader = useCallback(
    () => (
      <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.filterRow,
            { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm },
          ]}
        >
          {FILTER_CHIPS.map((chip) => (
            <FilterChipItem
              key={chip.key}
              chip={chip}
              isActive={activeFilter === chip.key}
              onPress={setActiveFilter}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [theme, activeFilter]
  );

  // ---------------------------------------------------------------------------
  // Loading state — full screen
  // ---------------------------------------------------------------------------
  if (isLoading && chats.length === 0) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <LoadingState message="Loading chats..." />
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderBottomColor: theme.colors.borderSubtle,
          },
        ]}
      >
        <Text
          style={[theme.textStyles.headingLarge, { color: theme.colors.text }]}
          accessibilityRole="header"
        >
          Pulse
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleFabPress}
            style={[styles.headerIcon, { marginRight: theme.spacing.xs }]}
            accessibilityRole="button"
            accessibilityLabel="Compose new message"
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={24} color={theme.colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleSearch}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel={isSearchVisible ? 'Close search' : 'Open search'}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSearchVisible ? 'close-outline' : 'search-outline'}
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsible search bar */}
      <Animated.View style={animatedSearchBar}>
        <View
          style={[
            styles.searchBarWrapper,
            {
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.sm,
              backgroundColor: theme.colors.background,
            },
          ]}
        >
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.lg,
                paddingHorizontal: theme.spacing.md,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={16}
              color={theme.colors.textTertiary}
              style={{ marginRight: theme.spacing.xs }}
            />
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search chats..."
              placeholderTextColor={theme.colors.textTertiary}
              style={[
                styles.searchInput,
                { color: theme.colors.text, fontSize: theme.fontSizes.md },
              ]}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search chats"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>

      {/* Filter chips + chat list */}
      <FlashList
        data={filteredChats}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmpty}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      />

      {/* FAB */}
      <Animated.View
        style={[
          styles.fab,
          animatedFab,
          {
            backgroundColor: theme.colors.primary,
            bottom: theme.spacing.xxl,
            right: theme.spacing.xxl,
            ...theme.shadows.md,
          },
        ]}
        entering={FadeIn.delay(300).duration(300)}
      >
        <TouchableOpacity
          onPress={handleFabPress}
          style={styles.fabInner}
          accessibilityRole="button"
          accessibilityLabel="New chat"
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    padding: 4,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ...(Platform.select({ web: { outlineStyle: 'none' } }) as object),
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeader: {
    // Background matches screen to give a sticky feel
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  fabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
