/**
 * Chat papkalari: getChatFolder / createChatFolder / editChatFolder /
 * deleteChatFolder / getRecommendedChatFolders. Papkalar ro'yxati o'zi
 * updateChatFolders orqali chat.store'ga keladi (chats.ts).
 */
import { td } from './client';
import type { TdObject } from './types';

export interface TdFormattedTextFull {
  '@type'?: 'formattedText';
  text: string;
  entities: unknown[];
}

export interface TdChatFolderName {
  '@type'?: 'chatFolderName';
  text: TdFormattedTextFull;
  animate_custom_emoji: boolean;
}

/** td_api.tl: chatFolder — barcha maydonlar. */
export interface TdChatFolder {
  '@type'?: 'chatFolder';
  name: TdChatFolderName;
  icon: { '@type'?: 'chatFolderIcon'; name: string } | null;
  color_id: number;
  is_shareable: boolean;
  pinned_chat_ids: number[];
  included_chat_ids: number[];
  excluded_chat_ids: number[];
  exclude_muted: boolean;
  exclude_read: boolean;
  exclude_archived: boolean;
  include_contacts: boolean;
  include_non_contacts: boolean;
  include_bots: boolean;
  include_groups: boolean;
  include_channels: boolean;
}

export interface TdRecommendedChatFolder {
  folder: TdChatFolder;
  description: string;
}

export function folderNameObject(text: string): TdChatFolderName {
  return {
    '@type': 'chatFolderName',
    text: { '@type': 'formattedText', text, entities: [] },
    animate_custom_emoji: false,
  };
}

export function emptyFolder(name = ''): TdChatFolder {
  return {
    '@type': 'chatFolder',
    name: folderNameObject(name),
    icon: null,
    color_id: -1,
    is_shareable: false,
    pinned_chat_ids: [],
    included_chat_ids: [],
    excluded_chat_ids: [],
    exclude_muted: false,
    exclude_read: false,
    exclude_archived: false,
    include_contacts: false,
    include_non_contacts: false,
    include_bots: false,
    include_groups: false,
    include_channels: false,
  };
}

export function folderTitle(f: TdChatFolder): string {
  return f.name?.text?.text ?? '';
}

/** TDLib'dan kelgan obyektni yuborishga tayyor ko'rinishga keltiradi. */
function normalize(f: TdChatFolder): TdChatFolder {
  return {
    '@type': 'chatFolder',
    name: {
      '@type': 'chatFolderName',
      text: { '@type': 'formattedText', text: f.name?.text?.text ?? '', entities: f.name?.text?.entities ?? [] },
      animate_custom_emoji: f.name?.animate_custom_emoji ?? false,
    },
    icon: f.icon?.name ? { '@type': 'chatFolderIcon', name: f.icon.name } : null,
    color_id: typeof f.color_id === 'number' ? f.color_id : -1,
    is_shareable: !!f.is_shareable,
    pinned_chat_ids: f.pinned_chat_ids ?? [],
    included_chat_ids: f.included_chat_ids ?? [],
    excluded_chat_ids: f.excluded_chat_ids ?? [],
    exclude_muted: !!f.exclude_muted,
    exclude_read: !!f.exclude_read,
    exclude_archived: !!f.exclude_archived,
    include_contacts: !!f.include_contacts,
    include_non_contacts: !!f.include_non_contacts,
    include_bots: !!f.include_bots,
    include_groups: !!f.include_groups,
    include_channels: !!f.include_channels,
  };
}

export async function getChatFolder(id: number): Promise<TdChatFolder> {
  const f = await td<TdObject & TdChatFolder>({ '@type': 'getChatFolder', chat_folder_id: id });
  return normalize(f);
}

export function createChatFolder(folder: TdChatFolder): Promise<TdObject> {
  return td({ '@type': 'createChatFolder', folder: normalize(folder) });
}

export function editChatFolder(id: number, folder: TdChatFolder): Promise<TdObject> {
  return td({ '@type': 'editChatFolder', chat_folder_id: id, folder: normalize(folder) });
}

export function deleteChatFolder(id: number): Promise<TdObject> {
  return td({ '@type': 'deleteChatFolder', chat_folder_id: id, leave_chat_ids: [] });
}

export async function getRecommendedChatFolders(): Promise<TdRecommendedChatFolder[]> {
  const r = await td<TdObject & { chat_folders: TdRecommendedChatFolder[] }>({ '@type': 'getRecommendedChatFolders' });
  return (r.chat_folders ?? []).map((x) => ({ folder: normalize(x.folder), description: x.description }));
}

/** Chat nomi (store'da bo'lmasa — getChat). */
export async function getChatTitle(chatId: number): Promise<string> {
  const c = await td<TdObject & { title: string }>({ '@type': 'getChat', chat_id: chatId });
  return c.title;
}
