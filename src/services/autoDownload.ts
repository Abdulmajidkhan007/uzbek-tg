/**
 * Media avto-yuklash qarori (Ma'lumotlar va xotira → Avtomatik yuklash).
 * Tarmoq turi AppNative.getNetworkType() dan olinadi va keshlanadi.
 */
import { AppState } from 'react-native';
import { AppNative } from '@/services/native';
import { useUIStore } from '@/stores/ui.store';

export type NetworkKind = 'wifi' | 'mobile' | 'roaming';
let network: NetworkKind = 'mobile';

export async function refreshNetworkType(): Promise<NetworkKind> {
  try {
    const t = await AppNative.getNetworkType();
    network = t === 'wifi' ? 'wifi' : t === 'roaming' ? 'roaming' : 'mobile';
  } catch {
    // ignore
  }
  return network;
}

export function currentNetwork(): NetworkKind {
  return network;
}

let started = false;
/** Ilova ochilganda va oldinga chiqqanda tarmoq turini yangilab turadi. */
export function startNetworkWatch(onChange?: (n: NetworkKind) => void): void {
  if (started) return;
  started = true;
  const update = () => {
    const before = network;
    void refreshNetworkType().then((n) => {
      if (n !== before) onChange?.(n);
    });
  };
  update();
  AppState.addEventListener('change', (s) => {
    if (s === 'active') update();
  });
  setInterval(update, 30000);
}

/** Shu turdagi va hajmdagi media avtomatik yuklansinmi. */
export function shouldAutoDownload(kind: 'photo' | 'video' | 'file', sizeBytes = 0): boolean {
  const rule = useUIStore.getState().autoDownload[network];
  if (!rule.enabled) return false;
  if (kind === 'photo') return rule.photos;
  const mb = sizeBytes / (1024 * 1024);
  if (kind === 'video') return rule.videos && mb <= rule.videoMaxMb;
  return rule.files && mb <= rule.fileMaxMb;
}
