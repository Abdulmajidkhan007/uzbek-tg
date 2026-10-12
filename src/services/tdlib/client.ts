/**
 * TDLib JSON klienti: native `Tdlib` moduli (android/.../tdlib/TdlibModule.kt)
 * ustidagi yupqa qatlam.
 *
 * - `td(query)` so'rov yuboradi va javobni Promise sifatida qaytaradi
 *   (`@extra` orqali moslashtiriladi). TDLib `error` qaytarsa — TdError.
 * - `onTdUpdate(fn)` — `@extra` siz kelgan update'larga obuna.
 */
import { NativeEventEmitter, NativeModules } from 'react-native';
import type { TdObject } from './types';

interface TdlibNative {
  start(): Promise<boolean>;
  send(request: string): void;
  execute(request: string): Promise<string | null>;
}

const Native = NativeModules.Tdlib as TdlibNative | undefined;

export class TdError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

type Pending = { resolve: (value: TdObject) => void; reject: (reason: TdError) => void };

const pending = new Map<string, Pending>();
const listeners = new Set<(update: TdObject) => void>();
let seq = 0;
let started: Promise<void> | null = null;
let emitterReady = false;

function handleEvent(raw: string): void {
  let obj: TdObject;
  try {
    obj = JSON.parse(raw) as TdObject;
  } catch {
    return;
  }
  const extra = obj['@extra'];
  if (typeof extra === 'string') {
    const p = pending.get(extra);
    if (p) {
      pending.delete(extra);
      if (obj['@type'] === 'error') {
        p.reject(new TdError(Number(obj.code), String(obj.message)));
      } else {
        p.resolve(obj);
      }
      return;
    }
  }
  listeners.forEach((fn) => fn(obj));
}

/** TDLib instance'ini ishga tushiradi (takroriy chaqiruv xavfsiz). */
export function startTdlib(): Promise<void> {
  if (!Native) {
    return Promise.reject(new TdError(-1, 'Tdlib native moduli topilmadi'));
  }
  if (!emitterReady) {
    new NativeEventEmitter(NativeModules.Tdlib).addListener('tdlib', handleEvent);
    emitterReady = true;
  }
  if (!started) {
    started = Native.start().then(
      () => undefined,
      (e: { code?: string; message?: string }) => {
        started = null;
        throw new TdError(-1, e.code === 'NO_API_KEYS' ? 'NO_API_KEYS' : e.message ?? String(e));
      },
    );
  }
  return started;
}

/** authorizationStateClosed dan keyin: keyingi startTdlib() yangi instance ochadi. */
export function resetTdlib(): void {
  started = null;
  pending.forEach((p) => p.reject(new TdError(-1, 'TDLib yopildi')));
  pending.clear();
}

export function td<T extends TdObject = TdObject>(query: TdObject): Promise<T> {
  if (!Native) return Promise.reject(new TdError(-1, 'Tdlib native moduli topilmadi'));
  const extra = `q${++seq}`;
  return new Promise<T>((resolve, reject) => {
    pending.set(extra, { resolve: resolve as (v: TdObject) => void, reject });
    Native.send(JSON.stringify({ ...query, '@extra': extra }));
  });
}

export function onTdUpdate(fn: (update: TdObject) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
