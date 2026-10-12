import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { AuthStackParamList } from './types';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { OTPScreen } from '@/screens/auth/OTPScreen';
import { PasswordScreen } from '@/screens/auth/PasswordScreen';
import { ProfileSetupScreen } from '@/screens/auth/ProfileSetupScreen';
import { useAuthStore } from '@/stores/auth.store';

const Stack = createStackNavigator<AuthStackParamList>();

/** Ilova kirish oqimining o'rtasida qayta ochilsa, TDLib holatidan davom etadi. */
function initialRoute(): keyof AuthStackParamList {
  switch (useAuthStore.getState().tdState) {
    case 'waitCode':
      return 'OTP';
    case 'waitPassword':
      return 'Password';
    case 'waitRegistration':
      return 'ProfileSetup';
    default:
      return 'Welcome';
  }
}

export function AuthNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator initialRouteName={initialRoute()} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} initialParams={{}} />
      <Stack.Screen name="Password" component={PasswordScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} initialParams={{}} />
    </Stack.Navigator>
  );
}
