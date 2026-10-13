import React, {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  SectionListData,
  TextInput,
  TouchableOpacity,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from '@/utils/haptics';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { useTheme } from '@/hooks/useTheme';
import Avatar from '@/components/common/Avatar';
import EmptyState from '@/components/common/EmptyState';
import Divider from '@/components/ui/Divider';
import { loadContacts, openPrivateChat } from '@/services/tdlib/chats';

interface ContactSection {
  letter: string;
  data: UserPreview[];
}

function toSections(list: UserPreview[]): ContactSection[] {
  const map = new Map<string, UserPreview[]>();
  for (const c of list) {
    const letter = (c.firstName.charAt(0) || '#').toUpperCase();
    map.set(letter, [...(map.get(letter) ?? []), c]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, data]) => ({ letter, data }));
}
import type { MainTabParamList } from '@/navigation/types';
import type { UserPreview } from '@/stores/chat.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type NavProp = BottomTabNavigationProp<MainTabParamList>;

// ---------------------------------------------------------------------------
// Contact row sub-component
// ---------------------------------------------------------------------------
interface ContactRowProps {
  contact: UserPreview;
  onPress: (contact: UserPreview) => void;
}

const ContactRow = React.memo(function ContactRow({ contact, onPress }: ContactRowProps) {
  const theme = useTheme();

  const handlePress = useCallback(() => {
    onPress(contact);
  }, [contact, onPress]);

  const fullName = `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ''}`;
  const statusLabel =
    contact.status === 'online'
      ? 'Online'
      : contact.status === 'recently'
      ? 'Recently'
      : contact.username ?? '';

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Open chat with ${fullName}`}
      style={[styles.contactRow, { paddingHorizontal: theme.spacing.lg }]}
    >
      <Avatar
        uri={contact.avatarUrl}
        name={fullName}
        size={44}
        showOnline
        isOnline={contact.status === 'online'}
      />
      <View style={styles.contactInfo}>
        <Text
          style={[
            theme.textStyles.chatName,
            { color: theme.colors.text },
          ]}
          numberOfLines={1}
        >
          {fullName}
          {contact.isVerified && (
            <Text style={{ color: theme.colors.primary }}> ✓</Text>
          )}
        </Text>
        {statusLabel.length > 0 && (
          <Text
            style={[
              theme.textStyles.bodySmall,
              {
                color:
                  contact.status === 'online'
                    ? theme.colors.secondary
                    : theme.colors.textSecondary,
              },
            ]}
            numberOfLines={1}
          >
            {statusLabel}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Section header sub-component
// ---------------------------------------------------------------------------
interface SectionHeaderProps {
  letter: string;
}

const SectionHeader = React.memo(function SectionHeader({ letter }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.sectionHeader,
        {
          backgroundColor: theme.colors.background,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.xs,
        },
      ]}
    >
      <Text
        style={[
          theme.textStyles.bodySmall,
          {
            color: theme.colors.primary,
            fontWeight: theme.fontWeights.semibold,
          },
        ]}
      >
        {letter}
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Section index strip
// ---------------------------------------------------------------------------
interface SectionIndexProps {
  letters: string[];
  onLetterPress: (letter: string) => void;
}

const SectionIndex = React.memo(function SectionIndex({
  letters,
  onLetterPress,
}: SectionIndexProps) {
  const theme = useTheme();
  return (
    <View style={styles.sectionIndex} pointerEvents="box-none">
      {letters.map((letter) => (
        <TouchableOpacity
          key={letter}
          onPress={() => {
            Haptics.selectionAsync();
            onLetterPress(letter);
          }}
          hitSlop={{ top: 2, bottom: 2, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`Jump to ${letter}`}
        >
          <Text
            style={[
              theme.textStyles.caption,
              {
                color: theme.colors.primary,
                fontWeight: theme.fontWeights.semibold,
                lineHeight: 16,
              },
            ]}
          >
            {letter}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function ContactsScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<NavProp>();

  const sectionListRef = useRef<SectionList<UserPreview, ContactSection>>(null);
  const searchInputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [contactSections, setContactSections] = useState<ContactSection[]>([]);

  useEffect(() => {
    loadContacts()
      .then((list) => setContactSections(toSections(list)))
      .catch(() => setContactSections([]));
  }, []);

  const searchBarHeight = useSharedValue(0);
  const searchBarOpacity = useSharedValue(0);

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
  // Filtered sections
  // ---------------------------------------------------------------------------
  const filteredSections = useMemo<ContactSection[]>(() => {
    if (searchQuery.trim().length === 0) return contactSections;
    const q = searchQuery.toLowerCase();
    return contactSections
      .map((section) => ({
        ...section,
        data: section.data.filter((c) => {
          const fullName = `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}`.toLowerCase();
          return fullName.includes(q) || (c.username ?? '').toLowerCase().includes(q);
        }),
      }))
      .filter((s) => s.data.length > 0);
  }, [searchQuery, contactSections]);

  const allLetters = useMemo(
    () => contactSections.map((s) => s.letter),
    [contactSections],
  );

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const handleContactPress = useCallback(
    (contact: UserPreview) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      openPrivateChat(contact.id)
        .then((chat) =>
          navigation.navigate('ChatsTab', {
            screen: 'ChatDetail',
            initial: false,
            params: {
              chatId: chat.id,
              chatType: chat.type,
              title: chat.name,
              avatarUrl: chat.avatarUrl,
            },
          }),
        )
        .catch(() => undefined);
    },
    [navigation],
  );

  const handleLetterPress = useCallback(
    (letter: string) => {
      const sectionIndex = filteredSections.findIndex((s) => s.letter === letter);
      if (sectionIndex >= 0) {
        sectionListRef.current?.scrollToLocation({
          sectionIndex,
          itemIndex: 0,
          animated: true,
          viewOffset: 0,
        });
      }
    },
    [filteredSections],
  );

  const handleInviteFriends = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: "Uzbek TG'da yozishaylik!",
        title: "Uzbek TG'ga taklif",
      });
    } catch {
      // Share dismissed
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderItem = useCallback(
    ({ item }: { item: UserPreview }) => (
      <ContactRow contact={item} onPress={handleContactPress} />
    ),
    [handleContactPress],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<UserPreview, ContactSection> }) => (
      <SectionHeader letter={section.letter} />
    ),
    [],
  );

  const renderItemSeparator = useCallback(() => <Divider inset={72} />, []);

  const renderFooter = useCallback(
    () => (
      <TouchableOpacity
        onPress={handleInviteFriends}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Invite Friends"
        style={[
          styles.inviteRow,
          {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            marginTop: theme.spacing.lg,
          },
        ]}
      >
        <View
          style={[
            styles.inviteIconContainer,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.full,
              width: 44,
              height: 44,
            },
          ]}
        >
          <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.inviteText}>
          <Text
            style={[
              theme.textStyles.chatName,
              { color: theme.colors.text },
            ]}
          >
            Invite Friends
          </Text>
          <Text
            style={[
              theme.textStyles.bodySmall,
              { color: theme.colors.textSecondary },
            ]}
          >
            Do'stlaringizni taklif qiling
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.colors.textTertiary}
        />
      </TouchableOpacity>
    ),
    [theme, handleInviteFriends],
  );

  const hasNoResults =
    searchQuery.trim().length > 0 && filteredSections.length === 0;

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
          Kontaktlar
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={toggleSearch}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel={isSearchVisible ? 'Close search' : 'Search contacts'}
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
              placeholder="Kontaktlarni qidirish..."
              placeholderTextColor={theme.colors.textTertiary}
              style={[
                styles.searchInput,
                {
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.md,
                },
              ]}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search contacts"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={theme.colors.textTertiary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>

      {/* Content */}
      <View style={styles.listContainer}>
        {hasNoResults ? (
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="👤"
              title="Kontakt topilmadi"
              subtitle={`"${searchQuery}" bo'yicha kontakt yo'q.`}
            />
          </View>
        ) : (
          <SectionList<UserPreview, ContactSection>
            ref={sectionListRef}
            sections={filteredSections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            ItemSeparatorComponent={renderItemSeparator}
            ListFooterComponent={renderFooter}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
            onScrollToIndexFailed={() => {}}
          />
        )}

        {/* Section index strip */}
        {!hasNoResults && searchQuery.trim().length === 0 && (
          <SectionIndex letters={allLetters} onLetterPress={handleLetterPress} />
        )}
      </View>
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
    ...(Platform.OS === 'web' ? { outline: 'none' } as object : {}),
  },
  listContainer: {
    flex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  contactInfo: {
    flex: 1,
  },
  sectionHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionIndex: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 2,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inviteIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteText: {
    flex: 1,
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
});
