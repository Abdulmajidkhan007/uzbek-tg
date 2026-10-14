/**
 * Proksi: TDLib'ning addProxy/enableProxy/disableProxy/removeProxy/getProxies/
 * pingProxy metodlari ustidagi qatlam va proksi havolalarini o'qish
 * (t.me/proxy?…, tg://socks?… va h.k.).
 */
import { td } from './client';
import type { TdObject } from './types';

export type ProxyKind = 'socks5' | 'http' | 'mtproto';

export type TdProxyType =
  | { '@type': 'proxyTypeSocks5'; username: string; password: string }
  | { '@type': 'proxyTypeHttp'; username: string; password: string; http_only: boolean }
  | { '@type': 'proxyTypeMtproto'; secret: string };

export interface TdProxy {
  '@type'?: 'proxy';
  server: string;
  port: number;
  type: TdProxyType;
}

export interface TdAddedProxy {
  id: number;
  last_used_date: number;
  is_enabled: boolean;
  comment: string;
  proxy: TdProxy;
}

export function proxyKind(p: TdProxy): ProxyKind {
  const ty = p.type['@type'];
  return ty === 'proxyTypeMtproto' ? 'mtproto' : ty === 'proxyTypeHttp' ? 'http' : 'socks5';
}

export function proxyKindLabel(k: ProxyKind): string {
  return k === 'mtproto' ? 'MTProto' : k === 'http' ? 'HTTP' : 'SOCKS5';
}

export function makeProxy(
  kind: ProxyKind,
  server: string,
  port: number,
  opts: { username?: string; password?: string; secret?: string } = {},
): TdProxy {
  let type: TdProxyType;
  if (kind === 'mtproto') type = { '@type': 'proxyTypeMtproto', secret: opts.secret ?? '' };
  else if (kind === 'http')
    type = { '@type': 'proxyTypeHttp', username: opts.username ?? '', password: opts.password ?? '', http_only: false };
  else type = { '@type': 'proxyTypeSocks5', username: opts.username ?? '', password: opts.password ?? '' };
  return { '@type': 'proxy', server: server.trim(), port, type };
}

export async function getProxies(): Promise<TdAddedProxy[]> {
  const r = await td<TdObject & { proxies: TdAddedProxy[] }>({ '@type': 'getProxies' });
  return r.proxies ?? [];
}

export function addProxy(proxy: TdProxy, enable = true): Promise<TdAddedProxy> {
  return td<TdObject & TdAddedProxy>({ '@type': 'addProxy', proxy: { ...proxy, '@type': 'proxy' }, enable, comment: '' });
}

export function enableProxy(id: number): Promise<TdObject> {
  return td({ '@type': 'enableProxy', proxy_id: id });
}

export function disableProxy(): Promise<TdObject> {
  return td({ '@type': 'disableProxy' });
}

export function removeProxy(id: number): Promise<TdObject> {
  return td({ '@type': 'removeProxy', proxy_id: id });
}

/** Ping (ms). Proksi ishlamasa — reject. */
export async function pingProxy(proxy: TdProxy): Promise<number> {
  const r = await td<TdObject & { seconds: number }>({ '@type': 'pingProxy', proxy: { ...proxy, '@type': 'proxy' } });
  return Math.round(r.seconds * 1000);
}

/** Proksini ulashish havolasi (t.me/proxy yoki t.me/socks). */
export function proxyLink(p: TdProxy): string {
  const base = `server=${encodeURIComponent(p.server)}&port=${p.port}`;
  if (p.type['@type'] === 'proxyTypeMtproto') return `https://t.me/proxy?${base}&secret=${encodeURIComponent(p.type.secret)}`;
  const u = p.type.username ? `&user=${encodeURIComponent(p.type.username)}&pass=${encodeURIComponent(p.type.password)}` : '';
  return `https://t.me/socks?${base}${u}`;
}

function parseQuery(q: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of q.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = (i < 0 ? part : part.slice(0, i)).toLowerCase();
    const v = i < 0 ? '' : part.slice(i + 1);
    try {
      out[k] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Matndan proksi havolasini o'qiydi:
 *   https://t.me/proxy?server=..&port=..&secret=..   (MTProto)
 *   tg://proxy?server=..&port=..&secret=..
 *   https://t.me/socks?server=..&port=..&user=..&pass=..  (SOCKS5)
 *   tg://socks?server=..&port=..
 */
export function parseProxyLink(text: string): TdProxy | null {
  const m = text.trim().match(/(?:tg:\/\/|(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/)(proxy|socks)\?([^\s#]+)/i);
  if (!m || !m[1] || !m[2]) return null;
  const q = parseQuery(m[2]);
  const server = q.server ?? '';
  const port = Number(q.port);
  if (!server || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
  if (m[1].toLowerCase() === 'proxy') {
    if (!q.secret) return null;
    return makeProxy('mtproto', server, port, { secret: q.secret });
  }
  return makeProxy('socks5', server, port, { username: q.user ?? '', password: q.pass ?? '' });
}

/** Mahalliy o'qish bo'lmasa — TDLib'ning o'zi (getInternalLinkType → internalLinkTypeProxy). */
export async function resolveProxyLink(text: string): Promise<TdProxy | null> {
  const local = parseProxyLink(text);
  if (local) return local;
  const link = text.trim();
  if (!link) return null;
  try {
    const r = await td<TdObject & { proxy?: TdProxy }>({ '@type': 'getInternalLinkType', link });
    if (r['@type'] === 'internalLinkTypeProxy' && r.proxy) return r.proxy;
  } catch {
    // havola emas
  }
  return null;
}
