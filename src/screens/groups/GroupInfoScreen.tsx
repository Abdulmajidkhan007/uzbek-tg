import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import Avatar from '@/components/common/Avatar';
import Divider from '@/components/ui/Divider';
import { mockChats, mockUsers } from '@/data/mock';
import type { ChatStackParamList } from '@/navigation/types';
import type { UserPreview } from '@/stores/chat.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<ChatStackParamList, 'GroupInfo'>;

interface ActionButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  color?: string;
}

// ---------------------------------------------------------------------------
// Action button sub-component
// ---------------------------------------------------------------------------
const ActionButton = React.memo(function ActionButton({
  icon,
  label,
  onPress,
  color,
}: ActionButtonProps) {
  const theme = useTheme();
  const iconColor = color ?? theme.colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.actionBtn,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text
        style={[
          theme.textStyles.caption,
          { color: iconColor, marginTop: theme.spacing.xs, fontWeight: theme.fontWeights.medium },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Member row sub-component
// ---------------------------------------------------------------------------
interface MemberRowProps {
  member: UserPreview;
  role: 'admin' | 'member';
  onPress: () => void;
}

const MemberRow = React.memo(function MemberRow({ member, role, onPress }: MemberRowProps) {
  const theme = useTheme();
  const fullName = `${member.firstName}${member.lastName ? ` ${member.lastName}` : ''}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={fullName}
      style={[styles.memberRow, { paddingHorizontal: theme.spacing.lg }]}
    >
      <Avatar
        uri={member.avatarUrl}
        name={fullName}
        size={44}
        showOnline
        isOnline={member.status === 'online'}
      />
      <View style={styles.memberInfo}>
        <Text
          style={[theme.textStyles.chatName, { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {fullName}
        </Text>
        <Text
          style={[
            theme.textStyles.bodySmall,
            {
              color:
                member.status === 'online'
                  ? theme.colors.secondary
                  : theme.colors.textSecondary,
            },
          ]}
          numberOfLines={1}
        >
          {member.status === 'online' ? 'Online' : member.username ?? 'Offline'}
        </Text>
      </View>
      {role === 'admin' && (
        <View
          style={[
            styles.roleBadge,
            {
              backgroundColor: theme.colors.primary + '22',
              borderRadius: theme.radius.xs,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 2,
            },
          ]}
        >
          <Text
            style={[
              theme.textStyles.caption,
              { color: theme.colors.primary, fontWeight: theme.fontWeights.semibold },
            ]}
          >
            Admin
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Media thumbnail sub-component
// ---------------------------------------------------------------------------
const MEDIA_URLS = [
  'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200',
  'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=200',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=200',
  'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=200',
];

const MediaThumbnail = React.memo(function MediaThumbnail({ uri }: { uri: string }) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="imagebutton"
      accessibilityLabel="View media"
      style={[
        styles.mediaThumbnail,
        {
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.surfaceElevated,
        },
      ]}
    >
      <Image source={{ uri }} style={styles.mediaImage} resizeMode="cover" />
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
const SectionTitle = React.memo(function SectionTitle({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        theme.textStyles.bodySmall,
        {
          color: theme.colors.textSecondary,
          fontWeight: theme.fontWeights.semibold,
          textTransform: 'uppercase',
          letterSpacing: theme.letterSpacing.wide,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xxl,
          paddingBottom: theme.spacing.sm,
        },
      ]}
    >
      {title}
    </Text>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function GroupInfoScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const { chatId } = route.params;

  const chat = useMemo(
    () => mockChats.find((c) => c.id === chatId) ?? null,
    [chatId],
  );

  const [isMuted, setIsMuted] = useState(chat?.isMuted ?? false);

  // Build mock member list from mockUsers (use first N users based on memberCount)
  const members = useMemo<UserPreview[]>(() => {
    const count = chat?.memberCount ?? 4;
    return mockUsers.slice(0, Math.min(count, mockUsers.length));
  }, [chat]);

  const isAdmin = true; // current user is always admin in this mock

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleEdit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Edit Group', 'Group editing is not available in this demo.');
  }, []);

  const handleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted((prev) => !prev);
  }, []);

  const handleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Search', 'Message search within this group coming soon.');
  }, []);

  const handleLeave = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${chat?.name ?? 'this group'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ],
    );
  }, [chat, navigation]);

  const handleMemberPress = useCallback(
    (member: UserPreview) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('Profile', { userId: member.id });
    },
    [navigation],
  );

  if (!chat) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={styles.errorContainer}>
          <Text style={[theme.textStyles.bodyMedium, { color: theme.colors.textSecondary }]}>
            Group not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderBottomColor: theme.colors.borderSubtle,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text
          style={[theme.textStyles.headingSmall, { color: theme.colors.text, flex: 1, textAlign: 'center' }]}
          numberOfLines={1}
        >
          Group Info
        </Text>
        {isAdmin ? (
          <TouchableOpacity
            onPress={handleEdit}
            activeOpacity={0.7}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Edit group"
          >
            <Ionicons name="create-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Hero section */}
        <View
          style={[
            styles.hero,
            {
              paddingVertical: theme.spacing.xxl,
              borderBottomColor: theme.colors.borderSubtle,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <Avatar
            uri={chat.avatarUrl}
            name={chat.name}
            size={80}
          />
          <Text
            style={[
              theme.textStyles.headingMedium,
              { color: theme.colors.text, marginTop: theme.spacing.md, textAlign: 'center' },
            ]}
          >
            {chat.name}
          </Text>
          <Text
            style={[
              theme.textStyles.bodySmall,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
            ]}
          >
            {chat.memberCount ?? members.length} members
          </Text>
          <Text
            style={[
              theme.textStyles.bodyMedium,
              {
                color: theme.colors.textSecondary,
                marginTop: theme.spacing.md,
                textAlign: 'center',
                paddingHorizontal: theme.spacing.xxl,
              },
            ]}
          >
            A collaborative space for sharing ideas, updates, and staying connected.
          </Text>
        </View>

        {/* Action buttons */}
        <View
          style={[
            styles.actionsRow,
            {
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.lg,
              gap: theme.spacing.md,
            },
          ]}
        >
          <ActionButton
            icon={isMuted ? 'notifications-off-outline' : 'notifications-outline'}
            label={isMuted ? 'Unmute' : 'Mute'}
            onPress={handleMute}
          />
          <ActionButton
            icon="search-outline"
            label="Search"
            onPress={handleSearch}
          />
          <ActionButton
            icon="exit-outline"
            label="Leave"
            onPress={handleLeave}
            color={theme.colors.error}
          />
        </View>

        <Divider />

        {/* Members section */}
        <SectionTitle title={`Members · ${chat.memberCount ?? members.length}`} />

        {members.map((member, index) => (
          <React.Fragment key={member.id}>
            <MemberRow
              member={member}
              role={index === 0 ? 'admin' : 'member'}
              onPress={() => handleMemberPress(member)}
            />
            {index < members.length - 1 && <Divider inset={72} />}
          </React.Fragment>
        ))}

        <Divider style={{ marginTop: theme.spacing.lg }} />

        {/* Shared media section */}
        <SectionTitle title="Shared Media" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            gap: theme.spacing.sm,
            paddingBottom: theme.spacing.sm,
          }}
        >
          {MEDIA_URLS.map((uri) => (
            <MediaThumbnail key={uri} uri={uri} />
          ))}
        </ScrollView>

        <Divider style={{ marginTop: theme.spacing.lg }} />

        {/* Danger zone */}
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xxl }}>
          <TouchableOpacity
            onPress={handleLeave}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Leave group"
            style={[
              styles.dangerButton,
              {
                backgroundColor: theme.colors.error + '18',
                borderColor: theme.colors.error + '40',
                borderRadius: theme.radius.md,
                paddingVertical: theme.spacing.md,
              },
            ]}
          >
            <Ionicons name="exit-outline" size={20} color={theme.colors.error} />
            <Text
              style={[
                theme.textStyles.buttonMedium,
                { color: theme.colors.error, marginLeft: theme.spacing.sm },
              ]}
            >
              Leave Group
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1 },
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 100,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  memberInfo: { flex: 1 },
  roleBadge: {},
  mediaThumbnail: {
    width: 80,
    height: 80,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
