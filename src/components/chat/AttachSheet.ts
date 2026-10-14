/**
 * Biriktirish menyusi: galereya (rasm/video, 10 tagacha), kamera, fayl.
 * Tanlangan fayllar `onPicked` ga OutgoingMedia sifatida beriladi.
 */
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { showActionSheet, showAlert } from '@/components/ui/Dialog';
import { AppNative } from '@/services/native';
import type { OutgoingMedia } from '@/services/tdlib/chats';
import { t } from '@/i18n';

function toMedia(a: Asset): OutgoingMedia | null {
  if (!a.uri) return null;
  const isVideo = (a.type ?? '').startsWith('video');
  return {
    kind: isVideo ? 'video' : 'photo',
    path: a.uri.replace(/^file:\/\//, ''),
    width: a.width,
    height: a.height,
    duration: a.duration,
  };
}

function handleError(code: string | undefined, message?: string): boolean {
  if (!code) return false;
  if (code !== 'camera_unavailable' && code !== 'permission' && code !== 'others') return false;
  showAlert(t('chat.actionFailed'), message ?? code);
  return true;
}

export function openAttachSheet(onPicked: (items: OutgoingMedia[]) => void): void {
  showActionSheet({
    options: [
      {
        text: t('chat.attach.gallery'),
        icon: 'images-outline',
        onPress: () => {
          launchImageLibrary({ mediaType: 'mixed', selectionLimit: 10, quality: 1 })
            .then((res) => {
              if (res.didCancel || handleError(res.errorCode, res.errorMessage)) return;
              const items = (res.assets ?? []).map(toMedia).filter((x): x is OutgoingMedia => x !== null);
              if (items.length) onPicked(items);
            })
            .catch((e: unknown) => showAlert(t('chat.actionFailed'), e instanceof Error ? e.message : String(e)));
        },
      },
      {
        text: t('chat.attach.camera'),
        icon: 'camera-outline',
        onPress: () => {
          launchCamera({ mediaType: 'photo', saveToPhotos: false, quality: 0.9 })
            .then((res) => {
              if (res.didCancel || handleError(res.errorCode, res.errorMessage)) return;
              const items = (res.assets ?? []).map(toMedia).filter((x): x is OutgoingMedia => x !== null);
              if (items.length) onPicked(items);
            })
            .catch((e: unknown) => showAlert(t('chat.actionFailed'), e instanceof Error ? e.message : String(e)));
        },
      },
      {
        text: t('chat.attach.file'),
        icon: 'document-outline',
        onPress: () => {
          AppNative.pickDocument()
            .then((f) => {
              if (f) onPicked([{ kind: 'document', path: f.path }]);
            })
            .catch((e: unknown) => showAlert(t('chat.actionFailed'), e instanceof Error ? e.message : String(e)));
        },
      },
    ],
  });
}
