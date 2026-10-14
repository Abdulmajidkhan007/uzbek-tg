import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { SettingsStackParamList } from './types';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { NotificationSettingsScreen } from '@/screens/settings/NotificationSettingsScreen';
import { PrivacySettingsScreen } from '@/screens/settings/PrivacySettingsScreen';
import { ThemeSettingsScreen } from '@/screens/settings/ThemeSettingsScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { BlockedUsersScreen } from '@/screens/settings/BlockedUsersScreen';
import { SessionsScreen } from '@/screens/settings/SessionsScreen';
import { StorageScreen } from '@/screens/settings/StorageScreen';
import { ChatFoldersScreen } from '@/screens/settings/ChatFoldersScreen';
import { ChatFolderEditScreen } from '@/screens/settings/ChatFolderEditScreen';
import { LanguageScreen } from '@/screens/settings/LanguageScreen';
import { PrivacyRuleScreen } from '@/screens/settings/PrivacyRuleScreen';
import { TwoStepScreen } from '@/screens/settings/TwoStepScreen';
import { ChatSettingsScreen } from '@/screens/settings/ChatSettingsScreen';
import { ChatWallpaperScreen } from '@/screens/settings/ChatWallpaperScreen';
import { DataStorageScreen } from '@/screens/settings/DataStorageScreen';
import { DataUsageScreen } from '@/screens/settings/DataUsageScreen';
import { AutoDownloadScreen } from '@/screens/settings/AutoDownloadScreen';
import { ProxyScreen } from '@/screens/settings/ProxyScreen';

const Stack = createStackNavigator<SettingsStackParamList>();

export function SettingsNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsMain" component={SettingsScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Stack.Screen name="ThemeSettings" component={ThemeSettingsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="Sessions" component={SessionsScreen} />
      <Stack.Screen name="Storage" component={StorageScreen} />
      <Stack.Screen name="ChatFolders" component={ChatFoldersScreen} />
      <Stack.Screen name="ChatFolderEdit" component={ChatFolderEditScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="PrivacyRule" component={PrivacyRuleScreen} />
      <Stack.Screen name="TwoStepVerification" component={TwoStepScreen} />
      <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} />
      <Stack.Screen name="ChatWallpaper" component={ChatWallpaperScreen} />
      <Stack.Screen name="DataStorage" component={DataStorageScreen} />
      <Stack.Screen name="DataUsage" component={DataUsageScreen} />
      <Stack.Screen name="AutoDownload" component={AutoDownloadScreen} />
      <Stack.Screen name="Proxy" component={ProxyScreen} />
    </Stack.Navigator>
  );
}
