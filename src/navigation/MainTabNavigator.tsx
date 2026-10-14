import React from 'react';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { MainTabParamList } from './types';
import { ChatNavigator } from './ChatNavigator';
import { SettingsNavigator } from './SettingsNavigator';
import { ContactsScreen } from '@/screens/main/ContactsScreen';
import { MyProfileScreen } from '@/screens/profile/MyProfileScreen';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import Avatar from '@/components/common/Avatar';
import { useT } from '@/i18n';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TABS: Record<keyof MainTabParamList, { label: string; icon: string; iconOn: string }> = {
  ChatsTab: { label: 'tabs.chats', icon: 'chatbubbles-outline', iconOn: 'chatbubbles' },
  ContactsTab: { label: 'tabs.contacts', icon: 'person-circle-outline', iconOn: 'person-circle' },
  SettingsTab: { label: 'tabs.settings', icon: 'settings-outline', iconOn: 'settings' },
  ProfileTab: { label: 'tabs.profile', icon: 'person-outline', iconOn: 'person' },
};

/** Tab ichidagi stack'ning ildiz ekranlari — faqat shularda panel ko'rinadi. */
const ROOT_SCREENS = new Set(['ChatList', 'SettingsMain']);

/** Telegram'dagi kabi suzuvchi "pill" panel. */
function FloatingTabBar({ state, navigation, insets }: BottomTabBarProps): React.JSX.Element | null {
  const theme = useTheme();
  const c = theme.colors;
  const t = useT();
  const user = useAuthStore((s) => s.currentUser);
  const unread = useChatStore((s) => s.chats.filter((x) => x.unreadCount > 0 && !x.isMuted).length);

  const focused = state.routes[state.index];
  const nested = focused ? getFocusedRouteNameFromRoute(focused) : undefined;
  if (nested && !ROOT_SCREENS.has(nested)) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 10 }]}>
      <View
        style={[
          styles.bar,
          theme.isDark
            ? { backgroundColor: c.surfaceElevated }
            : { backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
          theme.isDark ? theme.shadows.md : styles.lightShadow,
        ]}
      >
        {state.routes.map((route, i) => {
          const on = i === state.index;
          const meta = TABS[route.name as keyof MainTabParamList];
          const color = on ? c.primary : c.textSecondary;
          const onPress = () => {
            const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!on && !ev.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={[styles.item, on && { backgroundColor: c.primary + '22' }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(meta.label)}
            >
              <View>
                {route.name === 'ProfileTab' && user ? (
                  <View style={[styles.avatarRing, { borderColor: on ? c.primary : 'transparent' }]}>
                    <Avatar uri={user.avatarUrl} name={user.firstName || '?'} size={24} />
                  </View>
                ) : (
                  <Ionicons name={on ? meta.iconOn : meta.icon} size={24} color={color} />
                )}
                {route.name === 'ChatsTab' && unread > 0 ? (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: c.unreadBadge, borderColor: theme.isDark ? c.surfaceElevated : c.surface },
                    ]}
                  >
                    <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {t(meta.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MainTabNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tab.Screen name="ChatsTab" component={ChatNavigator} />
      <Tab.Screen name="ContactsTab" component={ContactsScreen} />
      <Tab.Screen name="SettingsTab" component={SettingsNavigator} />
      <Tab.Screen name="ProfileTab" component={MyProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    borderRadius: 32,
    padding: 5,
    marginHorizontal: 16,
    alignSelf: 'stretch',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 26,
  },
  label: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  lightShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 10,
  },
  avatarRing: { borderWidth: 1.5, borderRadius: 14, padding: 0.5 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
