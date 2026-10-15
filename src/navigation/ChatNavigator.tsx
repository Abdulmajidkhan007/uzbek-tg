import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { ChatStackParamList } from './types';
import { ArchivedChatsScreen, ChatListScreen } from '@/screens/main/ChatListScreen';
import { SearchScreen } from '@/screens/main/SearchScreen';
import { ChatDetailScreen } from '@/screens/chat/ChatDetailScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { GroupInfoScreen } from '@/screens/groups/GroupInfoScreen';
import { ChannelInfoScreen } from '@/screens/groups/ChannelInfoScreen';
import { ForwardMessageScreen } from '@/screens/chat/ForwardMessageScreen';
import { TopicDetailScreen } from '@/screens/groups/TopicDetailScreen';
import { MediaPreviewScreen } from '@/screens/chat/MediaPreviewScreen';
import { StoryViewerScreen } from '@/screens/stories/StoryViewerScreen';

const Stack = createStackNavigator<ChatStackParamList>();

export function ChatNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="ArchivedChats" component={ArchivedChatsScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="MediaPreview" component={MediaPreviewScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
      <Stack.Screen name="ChannelInfo" component={ChannelInfoScreen} />
      <Stack.Screen name="ForwardMessage" component={ForwardMessageScreen} />
      <Stack.Screen name="TopicDetail" component={TopicDetailScreen} />
      <Stack.Screen
        name="StoryViewer"
        component={StoryViewerScreen}
        options={{ animation: 'fade', gestureEnabled: false, cardStyle: { backgroundColor: '#000000' } }}
      />
    </Stack.Navigator>
  );
}
