import type { NavigatorScreenParams } from '@react-navigation/native';

export type ChatType = 'private' | 'group' | 'channel' | 'topic_group';

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  OTP: { phone?: string };
  Password: undefined;
  ProfileSetup: { phone?: string };
};

export type MainTabParamList = {
  ChatsTab: NavigatorScreenParams<ChatStackParamList>;
  ContactsTab: undefined;
  SearchTab: undefined;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};

export type ChatStackParamList = {
  ChatList: undefined;
  ChatDetail: {
    chatId: string;
    chatType: ChatType;
    title: string;
    avatarUrl?: string;
  };
  MediaPreview: {
    mediaUrls: string[];
    initialIndex: number;
    title: string;
    /** TDLib fayl: to'liq rasm/videoni ekran ochilgach yuklab oladi. */
    fileId?: number;
    kind?: 'photo' | 'video';
  };
  Profile: { userId: string };
  GroupInfo: { chatId: string };
  ChannelInfo: { chatId: string };
  ForwardMessage: { messageId: string; sourceChatId: string };
  TopicDetail: { chatId: string; topicId: string; topicTitle: string };
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  NotificationSettings: undefined;
  PrivacySettings: undefined;
  ThemeSettings: undefined;
  EditProfile: undefined;
  BlockedUsers: undefined;
};
