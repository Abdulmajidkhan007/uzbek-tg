/**
 * Chat ekrani: TDLib tarixidan xabarlar (FlashList inverted), sana ajratkichlari,
 * xizmat xabarlari, qadalgan xabar paneli, chat ichida qidiruv, xabar amallari,
 * javob/tahrirlash, media/ovoz yuborish, kanal uchun Ovozsiz/Qo'shilish paneli.
 *
 * Telegram Android kabi: xabarni bosish — menyu; uzoq bosish — tanlash rejimi
 * (barmoqni qo'ymay surib bir nechta xabarni belgilash). Klaviatura (edge-to-edge,
 * adjustResize ishlamaydi) — useAnimatedKeyboard bilan yozish paneli ko'tariladi.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Linking,
  Platform,
  BackHandler,
  Keyboard,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedKeyboard,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { isSameDay } from 'date-fns';
import type { StackScreenProps } from '@react-navigation/stack';
import * as Haptics from '@/utils/haptics';

import { useTheme } from '@/hooks/useTheme';
import { useT, t } from '@/i18n';
import { useChatStore, type Chat, type ChatMessage, type InlineButton, type MessageReply } from '@/stores/chat.store';
import {
  chatById,
  clearHistory,
  closeChat,
  deleteChat,
  deleteMessage as tdDeleteMessage,
  deleteMessages as tdDeleteMessages,
  editMessage,
  ensureMessageLoaded,
  getDiscussionChat,
  getDraftText,
  getInputMode,
  getMessageLink,
  getMessageProps,
  loadHistory,
  loadOlderMessages,
  loadPinnedMessage,
  markRead,
  onPinnedChanged,
  openChat,
  pressCallbackButton,
  reactionsFor,
  refreshHistory,
  resolveTelegramLink,
  resolveUsername,
  saveDraft,
  searchInChat,
  sendContact,
  sendLocation,
  sendMedia,
  sendText,
  sendVoice,
  setChatJoined,
  setChatMuted,
  setPinned,
  toggleReaction,
  votePoll,
  type InputMode,
  type MessageProps,
  type OutgoingMedia,
} from '@/services/tdlib/chats';
import { downloadFileNow } from '@/services/tdlib/files';
import { AppNative, type Recording } from '@/services/native';
import { setOpenChat } from '@/services/notifications';
import type { ChatStackParamList } from '@/navigation/types';

import Avatar from '@/components/common/Avatar';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageInput from '@/components/chat/MessageInput';
import PinnedBar from '@/components/chat/PinnedBar';
import AttachSheet from '@/components/chat/AttachSheet';
import { ChatBackground } from '@/components/chat/ChatBackground';
import { DateSeparator, ServicePill } from '@/components/chat/ServiceMessage';
import { ChatLinkContext, normalizeUrl, type ChatLinkHandlers } from '@/components/chat/linkActions';
import { dateSeparatorLabel, userStatusLabel } from '@/components/chat/chatFormat';
import { showAlert } from '@/components/ui/Dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<ChatStackParamList, 'ChatDetail'>;

type ListItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'service'; message: ChatMessage }
  | { kind: 'separator'; label: string; id: string };

interface MenuOption {
  key: string;
  label: string;
  icon: string;
  destructive?: boolean;
  onPress: () => void;
}

/** Android 15+ da targetSdk 35+ ilovalar majburan edge-to-edge (adjustResize ishlamaydi). */
const EDGE_TO_EDGE_FORCED = Platform.OS === 'android' && Number(Platform.Version) >= 35;

const TG_LINK = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\/|^tg:/i;

// ---------------------------------------------------------------------------
// Context menu (reaksiyalar qatori + amallar)
// ---------------------------------------------------------------------------
const ContextMenu = React.memo(function ContextMenu({
  visible,
  reactions,
  chosen,
  options,
  onReact,
  onClose,
}: {
  visible: boolean;
  reactions: string[];
  chosen: Set<string>;
  options: MenuOption[];
  onReact: (emoji: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: visible ? 150 : 100 });
    scale.value = visible ? withSpring(1, { damping: 20, stiffness: 300 }) : withTiming(0.9, { duration: 100 });
  }, [visible, opacity, scale]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  if (!visible) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={menuStyles.overlay} onPress={onClose}>
        <Animated.View
          style={[menuStyles.menu, animated, { backgroundColor: theme.colors.surfaceElevated, borderRadius: theme.radius.lg, ...theme.shadows.lg }]}
        >
          {reactions.length > 0 ? (
            <View style={[menuStyles.reactionsRow, { borderBottomColor: theme.colors.border }]}>
              {reactions.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => {
                    onReact(emoji);
                    onClose();
                  }}
                  style={[menuStyles.reactionButton, chosen.has(emoji) && { backgroundColor: `${theme.colors.primary}33` }]}
                  accessibilityRole="button"
                >
                  <Text style={menuStyles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {options.map((o, i) => (
            <TouchableOpacity
              key={o.key}
              onPress={() => {
                onClose();
                o.onPress();
              }}
              style={[
                menuStyles.optionRow,
                { borderTopColor: theme.colors.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth },
              ]}
              accessibilityRole="button"
            >
              <Ionicons name={o.icon} size={21} color={o.destructive ? theme.colors.error : theme.colors.textSecondary} style={{ marginRight: 16 }} />
              <Text style={[theme.textStyles.bodyMedium, { color: o.destructive ? theme.colors.error : theme.colors.text }]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

const menuStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  menu: { width: '100%', overflow: 'hidden' },
  reactionsRow: { flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 8 },
  reactionButton: { padding: 5, borderRadius: 18 },
  reactionEmoji: { fontSize: 26 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13 },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function ChatDetailScreen({ navigation, route }: Props) {
  const { chatId, chatType, title, avatarUrl } = route.params;
  const theme = useTheme();
  const tr = useT();

  const chatMessages = useChatStore((s) => s.messages[chatId]) ?? EMPTY;
  const storeChat = useChatStore(
    useCallback(
      (s) =>
        s.chats.find((c) => c.id === chatId) ??
        Object.values(s.listChats)
          .flat()
          .find((c) => c.id === chatId),
      [chatId],
    ),
  );
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const markChatAsRead = useChatStore((s) => s.markChatAsRead);

  // Ro'yxatlarda bo'lmagan chat (havola orqali ochilgan) — bir marta so'rab olinadi.
  const [fetchedChat, setFetchedChat] = useState<Chat | null>(null);
  const chat = storeChat ?? fetchedChat ?? undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [menu, setMenu] = useState<{ message: ChatMessage; options: MenuOption[] } | null>(null);
  const [pinned, setPinnedMsg] = useState<ChatMessage | null>(null);
  const [hiddenPinnedId, setHiddenPinnedId] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('input');
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pendingJump, setPendingJump] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState<{ query: string; results: string[]; index: number; busy: boolean } | null>(null);
  const [initialDraft] = useState(() => getDraftText(chatId));
  // Tanlash rejimi: tanlangan xabarlar (bo'sh — rejim o'chiq).
  const [selected, setSelected] = useState<ReadonlySet<string>>(EMPTY_SET);
  const selectionMode = selected.size > 0;
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [attach, setAttach] = useState<{ caption: string; clear: () => void } | null>(null);
  const [propsTick, setPropsTick] = useState(0);

  // Klaviatura: edge-to-edge'da oyna kichraymaydi — balandlik reanimated'dan olinadi,
  // pastki inset ayirib bo'sh joy qo'yiladi. Android 15+ (targetSdk 36) — edge-to-edge
  // majburiy: tizim panellari "shaffof" deb beriladi (balandlik nav panel bilan birga).
  // Eski Android'da reanimated o'zi panellar uchun chekka qo'yadi (insets 0 bo'ladi).
  const keyboard = useAnimatedKeyboard({
    isStatusBarTranslucentAndroid: EDGE_TO_EDGE_FORCED,
    isNavigationBarTranslucentAndroid: EDGE_TO_EDGE_FORCED,
  });
  const insets = useSafeAreaInsets();
  const bottomInset = useSharedValue(insets.bottom);
  useEffect(() => {
    bottomInset.value = insets.bottom;
  }, [insets.bottom, bottomInset]);
  const keyboardSpacer = useAnimatedStyle(() => ({ height: Math.max(0, keyboard.height.value - bottomInset.value) }));

  const listRef = useRef<FlashListRef<ListItem>>(null);
  const draftRef = useRef(initialDraft);
  const loadingOlder = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingRef = useRef<ChatMessage | null>(null);
  editingRef.current = editing;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const propsCache = useRef(new Map<string, MessageProps | null>());
  // Surib tanlash: ko'rinib turgan qatorlar (id → View) va joriy sudrash holati.
  const rowViews = useRef(new Map<string, View>());
  const drag = useRef<{
    anchor: number;
    base: Set<string>;
    last: number;
    frames: { id: string; top: number; bottom: number }[];
    /** Ro'yxat markazi (pageY) — o'lchov inverted transformni hisobga olmasa, ko'zgu o'qi. */
    axis: number;
    mirror: boolean | null;
  } | null>(null);
  const listContainerRef = useRef<View>(null);

  const isChannel = chatType === 'channel' || chat?.type === 'channel';
  const isGroup = !isChannel && (chatType === 'group' || chatType === 'topic_group' || chat?.type === 'group');

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const fail = useCallback((e: unknown) => {
    showAlert(t('chat.actionFailed'), e instanceof Error ? e.message : String(e));
  }, []);

  // ---------------------------------------------------------------------------
  // Ochish / yopish
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setActiveChatId(chatId);
    setOpenChat(chatId);
    setIsLoading(true);
    void openChat(chatId);
    loadHistory(chatId)
      .then(() => markRead(chatId))
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
    markChatAsRead(chatId);
    getInputMode(chatId)
      .then((r) => {
        setInputMode(r.mode);
        setIsBroadcast(r.isBroadcast);
      })
      .catch(() => undefined);
    loadPinnedMessage(chatId).then(setPinnedMsg).catch(() => undefined);
    if (!useChatStore.getState().chats.some((c) => c.id === chatId)) {
      chatById(chatId).then(setFetchedChat).catch(() => undefined);
    }
    const unsubPinned = onPinnedChanged((id) => {
      if (id === chatId) loadPinnedMessage(chatId).then(setPinnedMsg).catch(() => undefined);
    });

    return () => {
      unsubPinned();
      setActiveChatId(null);
      setOpenChat(null);
      void closeChat(chatId);
      if (!editingRef.current) void saveDraft(chatId, draftRef.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Til o'zgarsa — xizmat xabarlari va previewlar qayta tarjima qilinadi.
  const firstLang = useRef(tr.lang);
  useEffect(() => {
    if (firstLang.current !== tr.lang) refreshHistory(chatId);
    firstLang.current = tr.lang;
  }, [tr.lang, chatId]);

  // Chat ochiq turganda kelgan yangi xabarlarni o'qilgan deb belgilash.
  const newestId = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1]!.id : '';
  const newestIncoming = chatMessages.length > 0 && chatMessages[chatMessages.length - 1]!.senderId !== 'me';
  useEffect(() => {
    if (!isLoading && newestId && newestIncoming) void markRead(chatId);
  }, [newestId, newestIncoming, isLoading, chatId]);

  // ---------------------------------------------------------------------------
  // Ro'yxat ma'lumoti: sana ajratkichlari bilan, yangidan eskiga (inverted)
  // ---------------------------------------------------------------------------
  const listData = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    let lastDate: Date | null = null;
    for (const message of chatMessages) {
      if (lastDate === null || !isSameDay(message.sentAt, lastDate)) {
        items.push({ kind: 'separator', label: dateSeparatorLabel(tr, message.sentAt), id: `sep_${message.sentAt.toDateString()}` });
        lastDate = message.sentAt;
      }
      items.push({ kind: message.isService ? 'service' : 'message', message });
    }
    return items.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, tr.lang]);

  const listDataRef = useRef(listData);
  listDataRef.current = listData;
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    listData.forEach((it, i) => {
      if (it.kind === 'message') m.set(it.message.id, i);
    });
    return m;
  }, [listData]);
  const indexByIdRef = useRef(indexById);
  indexByIdRef.current = indexById;

  // ---------------------------------------------------------------------------
  // Xabarga o'tish (javob, qadalgan, qidiruv)
  // ---------------------------------------------------------------------------
  const flash = useCallback((id: string) => {
    setHighlightId(id);
    setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 1600);
  }, []);

  useEffect(() => {
    if (!pendingJump) return;
    const index = listData.findIndex((i) => i.kind !== 'separator' && i.message.id === pendingJump);
    if (index < 0) return;
    setPendingJump(null);
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 })?.catch(() => undefined);
      flash(pendingJump);
    }, 60);
  }, [pendingJump, listData, flash]);

  const jumpTo = useCallback(
    async (messageId: string) => {
      if (!messageId || messageId === '0') return;
      const found = await ensureMessageLoaded(chatId, messageId).catch(() => false);
      if (!found) {
        showToast(t('chat.messageNotFound'));
        return;
      }
      setPendingJump(messageId);
    },
    [chatId, showToast],
  );

  const handleEndReached = useCallback(() => {
    if (loadingOlder.current || isLoading) return;
    loadingOlder.current = true;
    loadOlderMessages(chatId)
      .catch(() => false)
      .finally(() => {
        loadingOlder.current = false;
      });
  }, [chatId, isLoading]);

  // ---------------------------------------------------------------------------
  // Havolalar (xabar matnidagi url, @mention, #hashtag, /buyruq)
  // ---------------------------------------------------------------------------
  const openChatScreen = useCallback(
    (c: Chat) => {
      if (c.id === chatId) return;
      navigation.push('ChatDetail', { chatId: c.id, chatType: c.type, title: c.name, avatarUrl: c.avatarUrl });
    },
    [navigation, chatId],
  );

  const startSearch = useCallback((query: string) => {
    setSearch({ query, results: [], index: 0, busy: false });
  }, []);

  const runSearch = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      setSearch({ query, results: [], index: 0, busy: true });
      const results = await searchInChat(chatId, q).catch(() => [] as string[]);
      setSearch({ query, results, index: 0, busy: false });
      if (results[0]) void jumpTo(results[0]);
      else showToast(t('chat.searchNoResults'));
    },
    [chatId, jumpTo, showToast],
  );

  const linkHandlers = useMemo<ChatLinkHandlers>(
    () => ({
      openUrl: (raw) => {
        const url = normalizeUrl(raw);
        if (TG_LINK.test(raw)) {
          resolveTelegramLink(url)
            .then((r) => {
              if (!r) return Linking.openURL(url);
              if (r.chat.id === chatId) {
                if (r.messageId) void jumpTo(r.messageId);
                return undefined;
              }
              openChatScreen(r.chat);
              return undefined;
            })
            .catch(() => showToast(t('chat.openLinkFailed')));
          return;
        }
        Linking.openURL(url).catch(() => showToast(t('chat.openLinkFailed')));
      },
      openMention: (username) => {
        resolveUsername(username)
          .then((c) => (c ? openChatScreen(c) : showAlert(t('chat.usernameNotFound'))))
          .catch(() => showAlert(t('chat.usernameNotFound')));
      },
      openUser: (userId) => navigation.navigate('Profile', { userId }),
      onHashtag: (tag) => {
        startSearch(tag);
        void runSearch(tag);
      },
      onBotCommand: inputMode === 'input' ? (cmd) => void sendText(chatId, cmd).catch(fail) : undefined,
    }),
    [chatId, navigation, openChatScreen, jumpTo, showToast, startSearch, runSearch, inputMode, fail],
  );

  // ---------------------------------------------------------------------------
  // Yuborish
  // ---------------------------------------------------------------------------
  const handleSendText = useCallback(
    async (text: string) => {
      const ed = editing;
      if (ed) {
        setEditing(null);
        try {
          await editMessage(chatId, ed.id, text, ed.type !== 'text');
        } catch (e) {
          fail(e);
        }
        return;
      }
      const replyToId = replyingTo?.id;
      setReplyingTo(null);
      draftRef.current = '';
      try {
        await sendText(chatId, text, replyToId);
      } catch (e) {
        showAlert(t('chat.sendError'), e instanceof Error ? e.message : String(e));
      }
    },
    [chatId, replyingTo, editing, fail],
  );

  const handleSendVoice = useCallback(
    async (rec: Recording) => {
      const replyToId = replyingTo?.id;
      setReplyingTo(null);
      try {
        await sendVoice(chatId, rec, replyToId);
      } catch (e) {
        showAlert(t('chat.sendError'), e instanceof Error ? e.message : String(e));
      }
    },
    [chatId, replyingTo],
  );

  // Biriktirish paneli: izoh asosiy maydon matnidan taklif qilinadi; yuborilsa maydon tozalanadi.
  const attachRef = useRef(attach);
  attachRef.current = attach;

  const handleAttach = useCallback((caption: string, clear: () => void) => {
    Keyboard.dismiss();
    setAttach({ caption, clear });
  }, []);

  const sheetSendMedia = useCallback(
    async (items: OutgoingMedia[], caption: string) => {
      await sendMedia(chatId, items, caption || undefined, replyingTo?.id);
      setReplyingTo(null);
      if (caption) attachRef.current?.clear();
    },
    [chatId, replyingTo],
  );

  const sheetSendLocation = useCallback(
    async (loc: { latitude: number; longitude: number; accuracy: number }) => {
      await sendLocation(chatId, loc, replyingTo?.id);
      setReplyingTo(null);
    },
    [chatId, replyingTo],
  );

  const sheetSendContact = useCallback(
    async (userId: string) => {
      await sendContact(chatId, userId, replyingTo?.id);
      setReplyingTo(null);
    },
    [chatId, replyingTo],
  );

  // ---------------------------------------------------------------------------
  // Xabar amallari (bosish — menyu)
  // ---------------------------------------------------------------------------
  const saveMedia = useCallback(
    async (msg: ChatMessage, mode: 'gallery' | 'share') => {
      if (!msg.mediaFileId) return;
      try {
        const uri = await downloadFileNow(msg.mediaFileId);
        const path = uri.replace(/^file:\/\//, '');
        const mime = msg.mimeType ?? (msg.type === 'video' ? 'video/mp4' : 'image/jpeg');
        if (mode === 'gallery') {
          const ok = await AppNative.saveToGallery(path, mime);
          showToast(ok ? t('chat.savedToGallery') : t('chat.saveFailed'));
        } else {
          await AppNative.shareFile(path, mime);
        }
      } catch (e) {
        fail(e);
      }
    },
    [showToast, fail],
  );

  const confirmDelete = useCallback(
    (msg: ChatMessage, props: MessageProps | null) => {
      const forAll = props?.canBeDeletedForAll ?? msg.senderId === 'me';
      const forSelf = props?.canBeDeletedOnlyForSelf ?? true;
      const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
      const run = (revoke: boolean) => () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        tdDeleteMessage(chatId, msg.id, revoke).catch(fail);
      };
      if (forAll && forSelf) {
        buttons.push({ text: t('chat.deleteForAll'), style: 'destructive', onPress: run(true) });
        buttons.push({ text: t('chat.deleteForMe'), style: 'destructive', onPress: run(false) });
      } else {
        buttons.push({ text: t('common.delete'), style: 'destructive', onPress: run(forAll) });
      }
      buttons.push({ text: t('common.cancel'), style: 'cancel' });
      showAlert(t('chat.deleteMessage'), t('chat.deleteConfirm'), buttons);
    },
    [chatId, fail],
  );

  const handleMessagePress = useCallback(
    async (msg: ChatMessage) => {
      if (selectedRef.current.size > 0) return;
      const props = await getMessageProps(chatId, msg.id);
      const opts: MenuOption[] = [];
      const canWrite = inputMode === 'input';
      const isMedia = msg.mediaFileId != null && !msg.isService;
      if (canWrite && (props?.canBeReplied ?? true) && !msg.isService) {
        opts.push({ key: 'reply', label: t('chat.reply'), icon: 'arrow-undo-outline', onPress: () => { setEditing(null); setReplyingTo(msg); } });
      }
      if (msg.text && !isMediaOnly(msg) && (props?.canBeCopied ?? true)) {
        opts.push({
          key: 'copy',
          label: t('common.copy'),
          icon: 'copy-outline',
          onPress: () => {
            Clipboard.setString(msg.text ?? '');
            showToast(t('chat.textCopied'));
          },
        });
      }
      if (props?.canGetLink) {
        opts.push({
          key: 'link',
          label: t('chat.copyLink'),
          icon: 'link-outline',
          onPress: () => {
            getMessageLink(chatId, msg.id)
              .then((link) => {
                Clipboard.setString(link);
                showToast(t('chat.linkCopied'));
              })
              .catch(fail);
          },
        });
      }
      if (props?.canBeEdited) {
        opts.push({ key: 'edit', label: t('common.edit'), icon: 'pencil-outline', onPress: () => { setReplyingTo(null); setEditing(msg); } });
      }
      if (props?.canBePinned) {
        opts.push({
          key: 'pin',
          label: msg.isPinned ? t('chat.unpin') : t('chat.pin'),
          icon: msg.isPinned ? 'pin' : 'pin-outline',
          onPress: () => {
            setPinned(chatId, msg.id, !msg.isPinned).catch(fail);
            setHiddenPinnedId(null);
          },
        });
      }
      if (props?.canBeForwarded) {
        opts.push({
          key: 'forward',
          label: t('chat.forward'),
          icon: 'arrow-redo-outline',
          onPress: () => navigation.navigate('ForwardMessage', { messageId: msg.id, sourceChatId: chatId }),
        });
      }
      if (isMedia && (props?.canBeSaved ?? true)) {
        if (msg.type === 'image' || msg.type === 'video') {
          opts.push({ key: 'save', label: t('chat.saveToGallery'), icon: 'download-outline', onPress: () => void saveMedia(msg, 'gallery') });
        }
        opts.push({ key: 'share', label: t('common.share'), icon: 'share-social-outline', onPress: () => void saveMedia(msg, 'share') });
      }
      if (!msg.isService) {
        opts.push({
          key: 'select',
          label: t('chat.select'),
          icon: 'checkmark-circle-outline',
          onPress: () => {
            Keyboard.dismiss();
            setSelected(new Set([msg.id]));
          },
        });
      }
      if (props ? props.canBeDeletedForAll || props.canBeDeletedOnlyForSelf : msg.senderId === 'me') {
        opts.push({ key: 'delete', label: t('common.delete'), icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(msg, props) });
      }
      if (opts.length === 0 && reactionsFor(chatId).length === 0) return;
      setMenu({ message: msg, options: opts });
    },
    [chatId, inputMode, navigation, showToast, fail, saveMedia, confirmDelete],
  );

  // ---------------------------------------------------------------------------
  // Tanlash rejimi
  // ---------------------------------------------------------------------------
  const clearSelection = useCallback(() => {
    drag.current = null;
    setScrollEnabled(true);
    setSelected(EMPTY_SET);
  }, []);

  const registerRow = useCallback((id: string, v: View | null) => {
    if (v) rowViews.current.set(id, v);
    else rowViews.current.delete(id);
  }, []);

  /** Uzoq bosish: xabarni tanlaydi va surib tanlashni boshlaydi. */
  const handleSelectStart = useCallback((msg: ChatMessage) => {
    if (msg.isService) return;
    const anchor = indexByIdRef.current.get(msg.id);
    if (anchor == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    const base = new Set(selectedRef.current);
    const d = {
      anchor,
      base,
      last: anchor,
      frames: [] as { id: string; top: number; bottom: number }[],
      axis: 0,
      mirror: null as boolean | null,
    };
    drag.current = d;
    listContainerRef.current?.measure((_x, _y, _w, h, _px, py) => {
      d.axis = py + h / 2;
    });
    setSelected(new Set([...base, msg.id]));
    setScrollEnabled(false);
    // Ko'rinib turgan qatorlarning ekrandagi o'rni (pageY bilan bir koordinatada).
    for (const [id, v] of rowViews.current) {
      v.measure((_x, _y, _w, h, _px, py) => {
        if (drag.current === d && h > 0) d.frames.push({ id, top: py, bottom: py + h });
      });
    }
  }, []);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    const d = drag.current;
    if (!d || d.frames.length === 0) return;
    if (d.mirror === null && d.frames.length >= 2) {
      // Inverted ro'yxatda yangi (kichik indeks) xabar pastda bo'ladi. O'lchov
      // transformsiz qaytsa tartib teskari chiqadi — barmoq o'rnini ko'zgulaymiz.
      const idx = (id: string) => indexByIdRef.current.get(id) ?? 0;
      const sorted = [...d.frames].sort((a, b) => idx(a.id) - idx(b.id));
      d.mirror = d.axis > 0 && sorted[0]!.top < sorted[sorted.length - 1]!.top;
    }
    const y = d.mirror ? 2 * d.axis - e.nativeEvent.pageY : e.nativeEvent.pageY;
    const f = d.frames.find((fr) => y >= fr.top && y < fr.bottom);
    if (!f) return;
    const idx = indexByIdRef.current.get(f.id);
    if (idx == null || idx === d.last) return;
    d.last = idx;
    const lo = Math.min(d.anchor, idx);
    const hi = Math.max(d.anchor, idx);
    const next = new Set(d.base);
    const data = listDataRef.current;
    for (let i = lo; i <= hi; i++) {
      const it = data[i];
      if (it && it.kind === 'message') next.add(it.message.id);
    }
    setSelected(next);
    Haptics.selectionAsync();
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    setScrollEnabled(true);
  }, []);

  const toggleSelect = useCallback((msg: ChatMessage) => {
    if (msg.isService) return;
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(msg.id)) next.delete(msg.id);
      else next.add(msg.id);
      return next;
    });
  }, []);

  // Android "orqaga" — tanlash rejimidan chiqadi.
  useEffect(() => {
    if (!selectionMode) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSelection();
      return true;
    });
    return () => sub.remove();
  }, [selectionMode, clearSelection]);

  // O'chirilgan / yo'qolgan xabarlar tanlovdan chiqariladi.
  useEffect(() => {
    if (selectedRef.current.size === 0) return;
    const ids = new Set(chatMessages.map((m) => m.id));
    const cur = selectedRef.current;
    if ([...cur].every((id) => ids.has(id))) return;
    setSelected(new Set([...cur].filter((id) => ids.has(id))));
  }, [chatMessages]);

  // Tanlanganlar uchun getMessageProperties (Uzatish/O'chirish/Nusxalash mumkinmi).
  useEffect(() => {
    const missing = [...selected].filter((id) => !propsCache.current.has(id));
    if (missing.length === 0) return;
    void Promise.all(missing.map((id) => getMessageProps(chatId, id).then((p) => [id, p] as const))).then((res) => {
      res.forEach(([id, p]) => propsCache.current.set(id, p));
      setPropsTick((x) => x + 1);
    });
  }, [selected, chatId]);

  /** Tanlangan xabarlar xronologik tartibda. */
  const selectedMessages = useMemo(
    () => (selected.size ? chatMessages.filter((m) => selected.has(m.id)) : EMPTY),
    [selected, chatMessages],
  );

  const selectionInfo = useMemo(() => {
    const ps = selectedMessages.map((m) => propsCache.current.get(m.id));
    const loaded = ps.every((p) => p !== undefined);
    const ok = (f: (p: MessageProps) => boolean) => loaded && ps.length > 0 && ps.every((p) => p != null && f(p));
    return {
      loaded,
      canForward: ok((p) => p.canBeForwarded),
      canDelete: ok((p) => p.canBeDeletedForAll || p.canBeDeletedOnlyForSelf),
      allForAll: ok((p) => p.canBeDeletedForAll),
      allForSelf: ok((p) => p.canBeDeletedOnlyForSelf),
      canCopy: ok((p) => p.canBeCopied) && selectedMessages.some((m) => !!m.text),
      canReply: inputMode === 'input' && selectedMessages.length === 1 && ok((p) => p.canBeReplied),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMessages, propsTick, inputMode]);

  const copySelected = useCallback(() => {
    const text = selectedMessages
      .map((m) => m.text ?? '')
      .filter((x) => x.length > 0)
      .join('\n\n');
    if (!text) return;
    Clipboard.setString(text);
    showToast(t('chat.messagesCopied'));
    clearSelection();
  }, [selectedMessages, showToast, clearSelection]);

  const forwardSelected = useCallback(() => {
    const ids = selectedMessages.map((m) => m.id);
    if (ids.length === 0) return;
    clearSelection();
    navigation.navigate('ForwardMessage', { messageId: ids.join(','), sourceChatId: chatId });
  }, [selectedMessages, clearSelection, navigation, chatId]);

  const replySelected = useCallback(() => {
    const msg = selectedMessages[0];
    if (!msg) return;
    clearSelection();
    setEditing(null);
    setReplyingTo(msg);
  }, [selectedMessages, clearSelection]);

  const deleteSelected = useCallback(() => {
    const msgs = selectedMessages;
    if (msgs.length === 0) return;
    const ids = msgs.map((m) => m.id);
    const { allForAll, allForSelf } = selectionInfo;
    const run = (mode: 'all' | 'self' | 'auto') => () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      clearSelection();
      if (mode === 'all') {
        tdDeleteMessages(chatId, ids, true).catch(fail);
        return;
      }
      if (mode === 'self') {
        tdDeleteMessages(chatId, ids, false).catch(fail);
        return;
      }
      // Aralash: faqat o'zi uchun mumkin bo'lganlari — revoke=false, qolganlari — revoke=true.
      const selfIds = ids.filter((id) => propsCache.current.get(id)?.canBeDeletedOnlyForSelf);
      const allIds = ids.filter((id) => !selfIds.includes(id));
      Promise.all([tdDeleteMessages(chatId, selfIds, false), tdDeleteMessages(chatId, allIds, true)]).catch(fail);
    };
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (allForAll && allForSelf) {
      buttons.push({ text: t('chat.deleteForAll'), style: 'destructive', onPress: run('all') });
      buttons.push({ text: t('chat.deleteForMe'), style: 'destructive', onPress: run('self') });
    } else {
      buttons.push({ text: t('common.delete'), style: 'destructive', onPress: run(allForAll ? 'all' : allForSelf ? 'self' : 'auto') });
    }
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    showAlert(tr.p('chat.deleteMessages', ids.length), t('chat.deleteMessagesConfirm'), buttons);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMessages, selectionInfo, chatId, fail, clearSelection, tr.lang]);

  const menuReactions = useMemo(() => (menu && !menu.message.isService ? reactionsFor(chatId) : []), [menu, chatId]);
  const menuChosen = useMemo(
    () => new Set(menu?.message.reactions.filter((r) => r.hasCurrentUser).map((r) => r.emoji) ?? []),
    [menu],
  );

  const handleReact = useCallback(
    (emoji: string) => {
      if (!menu) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void toggleReaction(chatId, menu.message.id, emoji, !menuChosen.has(emoji));
    },
    [chatId, menu, menuChosen],
  );

  const handleReactionPress = useCallback(
    (messageId: string, emoji: string) => {
      const msg = useChatStore.getState().messages[chatId]?.find((m) => m.id === messageId);
      const existing = msg?.reactions.find((r) => r.emoji === emoji);
      if (!existing) return;
      void toggleReaction(chatId, messageId, emoji, !existing.hasCurrentUser);
    },
    [chatId],
  );

  const handleReplyPress = useCallback(
    (reply: MessageReply) => {
      if (reply.chatId && reply.chatId !== chatId) {
        chatById(reply.chatId)
          .then((c) => c && openChatScreen(c))
          .catch(() => undefined);
        return;
      }
      void jumpTo(reply.messageId);
    },
    [chatId, jumpTo, openChatScreen],
  );

  const handleButtonPress = useCallback(
    async (msg: ChatMessage, b: InlineButton) => {
      switch (b.kind) {
        case 'url':
        case 'loginUrl':
        case 'webApp':
          if (b.url) linkHandlers.openUrl(b.url);
          return;
        case 'copyText':
          Clipboard.setString(b.copyText ?? '');
          showToast(t('common.copied'));
          return;
        case 'user':
          if (b.userId) navigation.navigate('Profile', { userId: b.userId });
          return;
        case 'callback': {
          if (!b.data) return;
          try {
            const res = await pressCallbackButton(chatId, msg.id, b.data);
            if (res.url) linkHandlers.openUrl(res.url);
            if (res.text) {
              if (res.showAlert) showAlert(chat?.name ?? title, res.text);
              else showToast(res.text);
            }
          } catch (e) {
            // Bot javob bermasa (timeout) — jim.
            if (e instanceof Error && !/timeout|BOT_RESPONSE_TIMEOUT/i.test(e.message)) fail(e);
          }
          return;
        }
        default:
          return;
      }
    },
    [chatId, chat?.name, title, linkHandlers, navigation, showToast, fail],
  );

  const handleCommentsPress = useCallback(
    (msg: ChatMessage) => {
      getDiscussionChat(chatId, msg.id)
        .then((c) => c && openChatScreen(c))
        .catch(fail);
    },
    [chatId, openChatScreen, fail],
  );

  const handleVote = useCallback(
    async (msg: ChatMessage, ids: number[]) => {
      await votePoll(chatId, msg.id, ids).catch(fail);
    },
    [chatId, fail],
  );

  const handleMediaPress = useCallback(
    (msg: ChatMessage) => {
      const preview = msg.mediaUrl ?? msg.thumbUrl;
      navigation.navigate('MediaPreview', {
        mediaUrls: preview ? [preview] : [],
        initialIndex: 0,
        title: msg.senderName || chat?.name || title,
        fileId: msg.mediaFileId,
        kind: msg.type === 'video' ? 'video' : 'photo',
      });
    },
    [navigation, chat?.name, title],
  );

  // ---------------------------------------------------------------------------
  // Sarlavha
  // ---------------------------------------------------------------------------
  const handleHeaderPress = useCallback(() => {
    if (isChannel) navigation.navigate('ChannelInfo', { chatId });
    else if (isGroup) navigation.navigate('GroupInfo', { chatId });
    else if (chat?.otherUser?.id) navigation.navigate('Profile', { userId: chat.otherUser.id });
  }, [isChannel, isGroup, chatId, chat, navigation]);

  const handleMoreOptions = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const muted = chat?.isMuted ?? false;
    const name = chat?.name ?? title;
    const opts: MenuOption[] = [
      { key: 'search', label: t('chat.searchInChat'), icon: 'search-outline', onPress: () => startSearch('') },
      {
        key: 'mute',
        label: muted ? t('chat.unmute') : t('chat.mute'),
        icon: muted ? 'notifications-outline' : 'notifications-off-outline',
        onPress: () => void setChatMuted(chatId, !muted).catch(fail),
      },
      { key: 'info', label: t('chat.info'), icon: 'information-circle-outline', onPress: handleHeaderPress },
    ];
    if (!isChannel) {
      opts.push({
        key: 'clear',
        label: t('chat.clearHistory'),
        icon: 'brush-outline',
        onPress: () =>
          showAlert(t('chat.clearHistory'), t('chat.clearHistoryConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('chat.clearHistory'), style: 'destructive', onPress: () => void clearHistory(chatId).catch(fail) },
          ]),
      });
    }
    if (inputMode !== 'join') {
      const leaveLabel = isChannel ? t('chat.leaveChannel') : isGroup ? t('chat.leaveGroup') : t('chat.deleteChat');
      opts.push({
        key: 'leave',
        label: leaveLabel,
        icon: isChannel || isGroup ? 'exit-outline' : 'trash-outline',
        destructive: true,
        onPress: () =>
          showAlert(leaveLabel, isChannel || isGroup ? t('chat.leaveConfirm', { name }) : t('chat.deleteChatConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: isChannel || isGroup ? t('chat.leave') : t('common.delete'),
              style: 'destructive',
              onPress: () =>
                deleteChat(chatId)
                  .then(() => navigation.goBack())
                  .catch(fail),
            },
          ]),
      });
    }
    setMenu({ message: SENTINEL, options: opts });
  }, [chat, title, chatId, isChannel, isGroup, inputMode, navigation, handleHeaderPress, startSearch, fail]);

  const headerSubtitle = useMemo(() => {
    if (chat?.isTyping && chat.typingUserName) return `${chat.typingUserName}…`;
    if (isChannel) return chat?.memberCount != null ? tr.p('chat.subscribers', chat.memberCount) : tr('chat.channel');
    if (isGroup) return chat?.memberCount != null ? tr.p('chat.members', chat.memberCount) : tr('chat.group');
    return userStatusLabel(tr, chat?.otherUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, isChannel, isGroup, tr.lang]);

  // ---------------------------------------------------------------------------
  // Render item
  // ---------------------------------------------------------------------------
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'separator') return <DateSeparator label={item.label} />;
      const { message } = item;
      if (item.kind === 'service') {
        return (
          <ServicePill
            text={message.text ?? ''}
            highlighted={highlightId === message.id}
            onLongPress={selectionMode ? undefined : () => void handleMessagePress(message)}
          />
        );
      }
      return (
        <MessageBubble
          message={message}
          isOwn={message.senderId === 'me' && !isChannel}
          showSender={isGroup && message.senderId !== 'me'}
          isChannel={isChannel}
          highlighted={highlightId === message.id}
          onPress={handleMessagePress}
          onLongPress={handleSelectStart}
          selectionMode={selectionMode}
          selected={selected.has(message.id)}
          onToggleSelect={toggleSelect}
          registerRow={registerRow}
          onReplyPress={handleReplyPress}
          onReactionPress={handleReactionPress}
          onMediaPress={handleMediaPress}
          onButtonPress={handleButtonPress}
          onCommentsPress={handleCommentsPress}
          onVote={handleVote}
        />
      );
    },
    [isChannel, isGroup, highlightId, selectionMode, selected, handleMessagePress, handleSelectStart, toggleSelect, registerRow, handleReplyPress, handleReactionPress, handleMediaPress, handleButtonPress, handleCommentsPress, handleVote],
  );

  const keyExtractor = useCallback((item: ListItem) => (item.kind === 'separator' ? item.id : item.message.id), []);
  const getItemType = useCallback((item: ListItem) => item.kind, []);
  const extraData = useMemo(() => ({ highlightId, selected }), [highlightId, selected]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const header = selectionMode ? (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border, paddingHorizontal: theme.spacing.sm }]}>
      <TouchableOpacity onPress={clearSelection} style={styles.backButton} accessibilityRole="button" accessibilityLabel={tr('chat.selection.exit')}>
        <Ionicons name="close" size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <Text style={[theme.textStyles.chatName, styles.selectionTitle, { color: theme.colors.text }]} numberOfLines={1}>
        {tr.p('chat.selected', selected.size)}
      </Text>
      {!selectionInfo.loaded ? <ActivityIndicator color={theme.colors.primary} style={{ marginHorizontal: 8 }} /> : null}
      {selectionInfo.canCopy ? (
        <TouchableOpacity onPress={copySelected} style={styles.headerIconButton} accessibilityRole="button" accessibilityLabel={tr('common.copy')}>
          <Ionicons name="copy-outline" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      ) : null}
      {selectionInfo.canForward ? (
        <TouchableOpacity onPress={forwardSelected} style={styles.headerIconButton} accessibilityRole="button" accessibilityLabel={tr('chat.forward')}>
          <Ionicons name="arrow-redo-outline" size={23} color={theme.colors.text} />
        </TouchableOpacity>
      ) : null}
      {selectionInfo.canDelete ? (
        <TouchableOpacity onPress={deleteSelected} style={styles.headerIconButton} accessibilityRole="button" accessibilityLabel={tr('common.delete')}>
          <Ionicons name="trash-outline" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      ) : null}
    </View>
  ) : search ? (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border, paddingHorizontal: theme.spacing.sm }]}>
      <TouchableOpacity onPress={() => setSearch(null)} style={styles.backButton} accessibilityRole="button" accessibilityLabel={tr('common.close')}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
      </TouchableOpacity>
      <TextInput
        autoFocus
        value={search.query}
        onChangeText={(q) => setSearch((s) => (s ? { ...s, query: q } : s))}
        onSubmitEditing={() => void runSearch(search.query)}
        returnKeyType="search"
        placeholder={tr('common.search')}
        placeholderTextColor={theme.colors.textTertiary}
        style={[styles.searchInput, { color: theme.colors.text }]}
      />
      {search.busy ? <ActivityIndicator color={theme.colors.primary} style={{ marginHorizontal: 8 }} /> : null}
      {search.results.length > 0 ? (
        <>
          <Text style={[theme.textStyles.caption, { color: theme.colors.textSecondary, marginHorizontal: 4 }]}>
            {tr('chat.searchCount', { i: search.index + 1, n: search.results.length })}
          </Text>
          <TouchableOpacity
            disabled={search.index >= search.results.length - 1}
            onPress={() => {
              const i = search.index + 1;
              setSearch({ ...search, index: i });
              void jumpTo(search.results[i]!);
            }}
            style={styles.headerIconButton}
          >
            <Ionicons name="chevron-up" size={22} color={search.index >= search.results.length - 1 ? theme.colors.textTertiary : theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            disabled={search.index <= 0}
            onPress={() => {
              const i = search.index - 1;
              setSearch({ ...search, index: i });
              void jumpTo(search.results[i]!);
            }}
            style={styles.headerIconButton}
          >
            <Ionicons name="chevron-down" size={22} color={search.index <= 0 ? theme.colors.textTertiary : theme.colors.primary} />
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  ) : (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border, paddingHorizontal: theme.spacing.sm }]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel={tr('chat.goBack')}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <TouchableOpacity onPress={handleHeaderPress} style={styles.headerCenter} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={tr('chat.info')}>
        <Avatar
          uri={chat?.avatarUrl ?? avatarUrl}
          name={chat?.name ?? title}
          size={38}
          showOnline={!isChannel && !isGroup}
          isOnline={chat?.isOnline}
          style={{ marginRight: theme.spacing.sm }}
        />
        <View style={styles.headerTitleGroup}>
          <Text style={[theme.textStyles.chatName, { color: theme.colors.text }]} numberOfLines={1}>
            {chat?.name ?? title}
          </Text>
          <Text
            style={[
              theme.textStyles.caption,
              {
                color:
                  chat?.isTyping || chat?.otherUser?.status === 'online' ? theme.colors.primary : theme.colors.textSecondary,
              },
            ]}
            numberOfLines={1}
          >
            {headerSubtitle}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.headerRight}>
        <TouchableOpacity onPress={handleMoreOptions} style={styles.headerIconButton} accessibilityRole="button" accessibilityLabel={tr('chat.moreOptions')}>
          <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const bottom =
    inputMode === 'mute' ? (
      <BottomButton
        label={chat?.isMuted ? tr('chat.unmute') : tr('chat.mute')}
        onPress={() => void setChatMuted(chatId, !(chat?.isMuted ?? false)).catch(fail)}
      />
    ) : inputMode === 'join' ? (
      <BottomButton
        label={tr('chat.join')}
        onPress={() =>
          setChatJoined(chatId, true)
            .then(() => getInputMode(chatId))
            .then((r) => {
              setInputMode(r.mode);
              setIsBroadcast(r.isBroadcast);
            })
            .catch(fail)
        }
      />
    ) : (
      <MessageInput
        chatId={chatId}
        replyingTo={replyingTo}
        editing={editing}
        placeholder={isBroadcast ? tr('chat.broadcastPlaceholder') : tr('chat.messagePlaceholder')}
        initialText={initialDraft}
        onSendText={handleSendText}
        onSendVoice={handleSendVoice}
        onAttach={handleAttach}
        onCancelReply={() => setReplyingTo(null)}
        onCancelEdit={() => setEditing(null)}
        onTextChange={(v) => {
          if (!editingRef.current) draftRef.current = v;
        }}
      />
    );

  const showPinned = pinned != null && hiddenPinnedId !== pinned.id && !search;

  // Tanlash rejimida pastda Telegram'dagi kabi "Javob berish" / "Uzatish" paneli.
  // MessageInput yashiriladi, lekin o'chirilmaydi (yozilgan matn saqlanadi).
  const selectionBar = selectionMode ? (
    <View style={[styles.selectionBar, { backgroundColor: theme.colors.inputBackground, borderTopColor: theme.colors.border, paddingBottom: insets.bottom }]}>
      {selectionInfo.canReply ? (
        <TouchableOpacity onPress={replySelected} style={styles.selectionAction} accessibilityRole="button">
          <Ionicons name="arrow-undo-outline" size={22} color={theme.colors.primary} />
          <Text style={[theme.textStyles.buttonMedium, { color: theme.colors.primary }]}>{tr('chat.reply')}</Text>
        </TouchableOpacity>
      ) : (
        <View />
      )}
      {selectionInfo.canForward ? (
        <TouchableOpacity onPress={forwardSelected} style={styles.selectionAction} accessibilityRole="button">
          <Text style={[theme.textStyles.buttonMedium, { color: theme.colors.primary }]}>{tr('chat.forward')}</Text>
          <Ionicons name="arrow-redo-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null;

  return (
    <ChatLinkContext.Provider value={linkHandlers}>
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {header}

        {showPinned ? (
          <PinnedBar message={pinned} onPress={() => void jumpTo(pinned.id)} onDismiss={() => setHiddenPinnedId(pinned.id)} />
        ) : null}

        <View
          ref={listContainerRef}
          collapsable={false}
          style={styles.listContainer}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <ChatBackground />
          {isLoading && chatMessages.length === 0 ? (
            <LoadingState message={tr('chat.loadingMessages')} />
          ) : (
            <FlashList
              ref={listRef}
              data={listData}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              getItemType={getItemType}
              extraData={extraData}
              scrollEnabled={scrollEnabled}
              inverted
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: theme.spacing.sm }}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              ListEmptyComponent={
                <View style={styles.emptyMessages}>
                  <EmptyState icon="💬" title={tr('chat.noMessages')} subtitle={inputMode === 'input' ? tr('chat.noMessagesHint') : undefined} />
                </View>
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            />
          )}
          {toast ? (
            <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(200)} style={styles.toast} pointerEvents="none">
              <Text style={styles.toastText}>{toast}</Text>
            </Animated.View>
          ) : null}
        </View>

        <View style={selectionMode ? styles.hidden : undefined}>{bottom}</View>
        {selectionBar}
        <Animated.View style={keyboardSpacer} />

        <ContextMenu
          visible={menu !== null}
          reactions={menuReactions}
          chosen={menuChosen}
          options={menu?.options ?? []}
          onReact={handleReact}
          onClose={() => setMenu(null)}
        />

        {attach ? (
          <AttachSheet
            initialCaption={attach.caption}
            keyboardHeight={keyboard.height}
            onClose={() => setAttach(null)}
            onSendMedia={sheetSendMedia}
            onSendLocation={sheetSendLocation}
            onSendContact={sheetSendContact}
          />
        ) : null}
      </SafeAreaView>
    </ChatLinkContext.Provider>
  );
}

function BottomButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: theme.colors.inputBackground }}>
      <TouchableOpacity
        onPress={onPress}
        style={[styles.bottomButton, { borderTopColor: theme.colors.border }]}
        accessibilityRole="button"
      >
        <Text style={[theme.textStyles.buttonMedium, { color: theme.colors.primary }]}>{label}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

/** Faqat media (matnsiz rasm/video/fayl) — "Nusxalash" ko'rsatilmaydi. */
function isMediaOnly(m: ChatMessage): boolean {
  return m.type !== 'text' && m.type !== 'system' && !m.text;
}

const EMPTY: ChatMessage[] = [];
const EMPTY_SET: ReadonlySet<string> = new Set<string>();
/** Sarlavha menyusi uchun (reaksiyalarsiz) bo'sh xabar. */
const SENTINEL = { id: '', isService: true, reactions: [] } as unknown as ChatMessage;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', height: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { padding: 6 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 4 },
  headerTitleGroup: { flex: 1, justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  headerIconButton: { padding: 6 },
  searchInput: { flex: 1, fontSize: 17, paddingVertical: 6, paddingHorizontal: 6 },
  listContainer: { flex: 1 },
  hidden: { display: 'none' },
  selectionTitle: { flex: 1, marginLeft: 12 },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
  },
  selectionAction: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 12 },
  emptyMessages: { flex: 1, minHeight: 400 },
  bottomButton: { height: 50, alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  toast: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: '86%',
  },
  toastText: { color: '#FFFFFF', fontSize: 14, textAlign: 'center' },
});
