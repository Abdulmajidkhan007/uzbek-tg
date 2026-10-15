/**
 * "Hikoya qo'shish" menyusi: galereya (rasm/video), kamera (rasm yoki video).
 * Tanlangan fayl darhol postStory bilan joylanadi; xato bo'lsa TDLib matni ko'rsatiladi.
 */
import { launchCamera, launchImageLibrary, type Asset, type ImagePickerResponse } from 'react-native-image-picker';
import { showActionSheet, showAlert } from '@/components/ui/Dialog';
import { postStory } from '@/services/tdlib/stories';
import { t } from '@/i18n';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function handle(res: ImagePickerResponse): void {
  if (res.didCancel) return;
  if (res.errorCode) {
    showAlert(t('stories.pickFailed'), res.errorMessage ?? res.errorCode);
    return;
  }
  const a: Asset | undefined = res.assets?.[0];
  if (!a?.uri) return;
  const isVideo = (a.type ?? '').startsWith('video');
  postStory({ kind: isVideo ? 'video' : 'photo', path: a.uri, duration: a.duration }).catch((e: unknown) =>
    showAlert(t('stories.postFailed'), errorText(e)),
  );
}

export function openAddStorySheet(): void {
  showActionSheet({
    title: t('stories.add'),
    options: [
      {
        text: t('stories.fromGallery'),
        icon: 'images-outline',
        onPress: () => {
          launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1, quality: 1 })
            .then(handle)
            .catch((e: unknown) => showAlert(t('stories.pickFailed'), errorText(e)));
        },
      },
      {
        text: t('stories.fromCamera'),
        icon: 'camera-outline',
        onPress: () => {
          launchCamera({ mediaType: 'photo', saveToPhotos: false, quality: 0.9 })
            .then(handle)
            .catch((e: unknown) => showAlert(t('stories.pickFailed'), errorText(e)));
        },
      },
      {
        text: t('stories.fromCameraVideo'),
        icon: 'videocam-outline',
        onPress: () => {
          launchCamera({ mediaType: 'video', saveToPhotos: false, durationLimit: 60, videoQuality: 'high' })
            .then(handle)
            .catch((e: unknown) => showAlert(t('stories.pickFailed'), errorText(e)));
        },
      },
    ],
  });
}
