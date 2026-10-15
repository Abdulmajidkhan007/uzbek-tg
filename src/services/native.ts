/**
 * AppNative (android/.../nativeapi/AppNativeModule.kt) uchun tipli o'ram.
 */
import { NativeEventEmitter, NativeModules } from 'react-native';

export interface PickedFile {
  path: string;
  name: string;
  size: number;
  mime: string;
}

export interface Recording {
  path: string;
  duration: number;
  isOgg: boolean;
  /** Telegram formatidagi waveform (base64, 5-bit qiymatlar). */
  waveform: string;
}

export interface GalleryItem {
  uri: string;
  id: string;
  isVideo: boolean;
  mime: string;
  width: number;
  height: number;
  date: number;
  /** Video davomiyligi (soniya). */
  duration: number;
}

interface AppNativeApi {
  hasMediaPermission(): Promise<boolean>;
  requestMediaPermission(): Promise<boolean>;
  getRecentMedia(limit: number): Promise<GalleryItem[]>;
  /** content:// → kesh fayl yo'li. */
  copyToCache(uri: string): Promise<PickedFile>;
  requestLocationPermission(): Promise<boolean>;
  getCurrentLocation(): Promise<{ latitude: number; longitude: number; accuracy: number }>;
  captureScreen(): Promise<string>;
  hasMicPermission(): Promise<boolean>;
  requestMicPermission(): Promise<boolean>;
  startRecording(): Promise<boolean>;
  getAmplitude(): Promise<number>;
  stopRecording(): Promise<Recording>;
  cancelRecording(): void;
  pickDocument(): Promise<PickedFile | null>;
  hasNotificationPermission(): Promise<boolean>;
  requestNotificationPermission(): Promise<boolean>;
  showNotification(id: number, chatId: string, title: string, body: string, silent: boolean): void;
  cancelNotification(id: number): void;
  cancelAllNotifications(): void;
  getLaunchChatId(): Promise<string | null>;
  saveToGallery(path: string, mime: string): Promise<boolean>;
  shareFile(path: string, mime: string): Promise<boolean>;
  openFile(path: string, mime: string): Promise<boolean>;
  getNetworkType(): Promise<'wifi' | 'mobile' | 'roaming' | 'none' | 'other'>;
}

export const AppNative = NativeModules.AppNative as AppNativeApi;

const emitter = AppNative ? new NativeEventEmitter(NativeModules.AppNative) : null;

/** Ilova ochiq paytda bildirishnoma bosilsa — chat id. */
export function onOpenChatFromNotification(fn: (chatId: string) => void): () => void {
  const sub = emitter?.addListener('appNativeOpenChat', fn);
  return () => sub?.remove();
}
