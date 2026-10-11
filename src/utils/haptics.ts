/**
 * expo-haptics API'si (impactAsync, notificationAsync, selectionAsync) —
 * react-native-haptic-feedback ustida. Ekranlar shu nomlar bilan chaqiradi,
 * shuning uchun Expo'dan ko'chganda faqat import yo'li o'zgardi.
 */
import HapticFeedback, { HapticFeedbackTypes } from 'react-native-haptic-feedback';

export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
}

export enum NotificationFeedbackType {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

const options = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const impactMap: Record<ImpactFeedbackStyle, HapticFeedbackTypes> = {
  [ImpactFeedbackStyle.Light]: HapticFeedbackTypes.impactLight,
  [ImpactFeedbackStyle.Medium]: HapticFeedbackTypes.impactMedium,
  [ImpactFeedbackStyle.Heavy]: HapticFeedbackTypes.impactHeavy,
};

const notificationMap: Record<NotificationFeedbackType, HapticFeedbackTypes> = {
  [NotificationFeedbackType.Success]: HapticFeedbackTypes.notificationSuccess,
  [NotificationFeedbackType.Warning]: HapticFeedbackTypes.notificationWarning,
  [NotificationFeedbackType.Error]: HapticFeedbackTypes.notificationError,
};

export async function impactAsync(
  style: ImpactFeedbackStyle = ImpactFeedbackStyle.Medium,
): Promise<void> {
  HapticFeedback.trigger(impactMap[style], options);
}

export async function notificationAsync(
  type: NotificationFeedbackType = NotificationFeedbackType.Success,
): Promise<void> {
  HapticFeedback.trigger(notificationMap[type], options);
}

export async function selectionAsync(): Promise<void> {
  HapticFeedback.trigger(HapticFeedbackTypes.selection, options);
}
