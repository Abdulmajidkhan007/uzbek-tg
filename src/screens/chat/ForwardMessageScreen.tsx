import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import Avatar from '@/components/common/Avatar';
import EmptyState from '@/components/common/EmptyState';
import Divider from '@/components/ui/Divider';
import { useChatStore } from '@/stores/chat.store';
import { td } from '@/services/tdlib/client';
import type { ChatStackParamList } from '@/navigation/types';
import type { Chat } from '@/stores/chat.store';
import { showAlert } from '@/components/ui/Dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<ChatStackParamList, 'ForwardMessage'>;

// ---------------------------------------------------------------------------
// Chat forward row sub-component
// ---------------------------------------------------------------------------
interface ForwardRowProps {
  chat: Chat;
  isSelected: boolean;
  onToggle: (chatId: string) => void;
}

const ForwardRow = React.memo(function ForwardRow({
  chat,
  isSelected,
  onToggle,
}: ForwardRowProps) {
  const theme = useTheme();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(chat.id);
  }, [chat.id, onToggle]);

  const subtitle = useMemo(() => {
    if (chat.type === 'private') {
      return chat.otherUser?.username ?? chat.otherUser?.status ?? '';
    }
    if (chat.memberCount != null) {
      if (chat.type === 'channel') return `${chat.memberCount.toLocaleString()} subscribers`;
      return `${chat.memberCount} members`;
    }
    return '';
  }, [chat]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${isSelected ? 'Deselect' : 'Select'} ${chat.name}`}
      accessibilityState={{ selected: isSelected }}
      style={[styles.row, { paddingHorizontal: theme.spacing.lg }]}
    >
      <View style={styles.avatarWrapper}>
        <Avatar
          uri={chat.avatarUrl}
          name={chat.name}
          size={50}
          showOnline={chat.type === 'private'}
          isOnline={chat.isOnline}
        />
        {chat.type === 'channel' && (
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: theme.colors.accent,
                borderRadius: theme.radius.full,
                borderColor: theme.colors.background,
              },
            ]}
          >
            <Ionicons name="megaphone" size={8} color="#FFFFFF" />
          </View>
        )}
        {(chat.type === 'group' || chat.type === 'topic_group') && (
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: theme.colors.secondary,
                borderRadius: theme.radius.full,
                borderColor: theme.colors.background,
              },
            ]}
          >
            <Ionicons name="people" size={8} color="#FFFFFF" />
          </View>
        )}
      </View>

      <View style={styles.chatInfo}>
        <Text
          style={[theme.textStyles.chatName, { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {chat.name}
        </Text>
        {subtitle.length > 0 && (
          <Text
            style={[theme.textStyles.bodySmall, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: isSelected ? theme.colors.primary : 'transparent',
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
            borderRadius: theme.radius.full,
          },
        ]}
      >
        {isSelected && (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        )}
      </View>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function ForwardMessageScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const { messageId, sourceChatId } = route.params;

  const searchInputRef = useRef<TextInput>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allChats = useChatStore((s) => s.chats);
  const filteredChats = useMemo<Chat[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length === 0) return allChats;
    return allChats.filter((c) => c.name.toLowerCase().includes(q));
  }, [searchQuery, allChats]);

  const handleToggle = useCallback((chatId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleForward = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      for (const id of selectedIds) {
        await td({
          '@type': 'forwardMessages',
          chat_id: Number(id),
          from_chat_id: Number(sourceChatId),
          message_ids: [Number(messageId)],
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (e) {
      showAlert('Uzatilmadi', e instanceof Error ? e.message : String(e));
    }
  }, [selectedIds, navigation, sourceChatId, messageId]);

  const renderItem = useCallback(
    ({ item }: { item: Chat }) => (
      <ForwardRow
        chat={item}
        isSelected={selectedIds.has(item.id)}
        onToggle={handleToggle}
      />
    ),
    [selectedIds, handleToggle],
  );

  const keyExtractor = useCallback((item: Chat) => item.id, []);

  const renderSeparator = useCallback(() => <Divider inset={78} />, []);

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyWrapper}>
        <EmptyState
          icon="💬"
          title="No chats found"
          subtitle="Try a different search term."
        />
      </View>
    ),
    [],
  );

  const selectedCount = selectedIds.size;

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderBottomColor: theme.colors.borderSubtle,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleClose}
          activeOpacity={0.7}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text
          style={[
            theme.textStyles.headingSmall,
            { color: theme.colors.text, flex: 1, textAlign: 'center' },
          ]}
        >
          Forward to...
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Search bar */}
      <View
        style={[
          styles.searchWrapper,
          {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
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
            accessibilityLabel="Search chats to forward to"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={16} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Selected chips preview */}
      {selectedCount > 0 && (
        <View
          style={[
            styles.selectedBar,
            {
              backgroundColor: theme.colors.surface,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.sm,
              borderBottomColor: theme.colors.borderSubtle,
            },
          ]}
        >
          <Text
            style={[
              theme.textStyles.bodySmall,
              { color: theme.colors.primary, fontWeight: theme.fontWeights.semibold },
            ]}
          >
            {selectedCount} chat{selectedCount > 1 ? 's' : ''} selected
          </Text>
        </View>
      )}

      {/* Chat list */}
      <View style={styles.flex}>
        <FlashList
          data={filteredChats}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        />
      </View>

      {/* Forward button */}
      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleForward}
          activeOpacity={0.8}
          disabled={selectedCount === 0}
          accessibilityRole="button"
          accessibilityLabel={
            selectedCount === 0
              ? 'Select at least one chat to forward'
              : `Forward to ${selectedCount} chat${selectedCount > 1 ? 's' : ''}`
          }
          style={[
            styles.forwardBtn,
            {
              backgroundColor:
                selectedCount > 0 ? theme.colors.primary : theme.colors.surfaceElevated,
              borderRadius: theme.radius.full,
              paddingVertical: theme.spacing.md,
            },
          ]}
        >
          <Ionicons
            name="arrow-redo-outline"
            size={18}
            color={selectedCount > 0 ? '#FFFFFF' : theme.colors.textTertiary}
          />
          <Text
            style={[
              theme.textStyles.buttonMedium,
              {
                color: selectedCount > 0 ? '#FFFFFF' : theme.colors.textTertiary,
                marginLeft: theme.spacing.sm,
              },
            ]}
          >
            {selectedCount > 0
              ? `Forward (${selectedCount})`
              : 'Select chats to forward'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrapper: {
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
    ...(Platform.OS === 'web' ? { outline: 'none' } as object : {}),
  },
  selectedBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  typeBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  chatInfo: {
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 300,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  forwardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
