/**
 * Telegram uslubidagi dialog va pastdan chiqadigan menyu.
 *
 *   showAlert(title, message?, buttons?)   — Alert.alert bilan bir xil imzo
 *   showActionSheet({ title?, options })    — ro'yxatli menyu (pastdan)
 *
 * <DialogHost /> ilova ildizida bir marta qo'yiladi (App.tsx).
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@/hooks/useTheme';

export interface DialogButton {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface SheetOption {
  text: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
}

type DialogState =
  | { kind: 'alert'; title: string; message?: string; buttons: DialogButton[] }
  | { kind: 'sheet'; title?: string; options: SheetOption[] }
  | null;

let setGlobal: ((s: DialogState) => void) | null = null;
const queue: DialogState[] = [];

function open(state: DialogState): void {
  if (setGlobal) setGlobal(state);
  else queue.push(state);
}

export function showAlert(
  title: string,
  message?: string,
  buttons?: DialogButton[],
  _options?: { cancelable?: boolean },
): void {
  open({ kind: 'alert', title, message, buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }] });
}

export function showActionSheet(sheet: { title?: string; options: SheetOption[] }): void {
  open({ kind: 'sheet', ...sheet });
}

export function DialogHost(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<DialogState>(null);

  useEffect(() => {
    setGlobal = setState;
    const pending = queue.shift();
    if (pending) setState(pending);
    return () => {
      setGlobal = null;
    };
  }, []);

  const close = (after?: () => void) => {
    setState(null);
    // Modal yopilgach keyingi amal (u ham dialog ochishi mumkin).
    if (after) setTimeout(after, 50);
  };

  const c = theme.colors;
  return (
    <Modal
      visible={state !== null}
      transparent
      animationType={state?.kind === 'sheet' ? 'slide' : 'fade'}
      statusBarTranslucent
      onRequestClose={() => close()}
    >
      <Pressable style={[styles.backdrop, state?.kind === 'sheet' && styles.backdropSheet]} onPress={() => close()}>
        {state?.kind === 'alert' ? (
          <Pressable style={[styles.alert, { backgroundColor: c.surfaceElevated }]} onPress={() => undefined}>
            <Text style={[styles.alertTitle, { color: c.text }]}>{state.title}</Text>
            {state.message ? (
              <Text style={[styles.alertMessage, { color: c.textSecondary }]}>{state.message}</Text>
            ) : null}
            <View style={styles.alertButtons}>
              {state.buttons.map((b, i) => (
                <Pressable
                  key={i}
                  onPress={() => close(b.onPress)}
                  style={({ pressed }) => [styles.alertButton, pressed && { backgroundColor: c.surfaceHighlight }]}
                >
                  <Text
                    style={[
                      styles.alertButtonText,
                      { color: b.style === 'destructive' ? c.error : c.primary },
                      b.style === 'cancel' && { fontWeight: '500' },
                    ]}
                  >
                    {(b.text ?? 'OK').toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        ) : null}

        {state?.kind === 'sheet' ? (
          <Pressable
            style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 8 }]}
            onPress={() => undefined}
          >
            <View style={[styles.handle, { backgroundColor: c.border }]} />
            {state.title ? <Text style={[styles.sheetTitle, { color: c.textSecondary }]}>{state.title}</Text> : null}
            {state.options.map((o, i) => (
              <Pressable
                key={i}
                onPress={() => close(o.onPress)}
                style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: c.surfaceHighlight }]}
              >
                {o.icon ? (
                  <Ionicons
                    name={o.icon}
                    size={22}
                    color={o.destructive ? c.error : c.textSecondary}
                    style={styles.sheetIcon}
                  />
                ) : null}
                <Text style={[styles.sheetText, { color: o.destructive ? c.error : c.text }]}>{o.text}</Text>
              </Pressable>
            ))}
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  backdropSheet: { justifyContent: 'flex-end', padding: 0 },
  alert: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  alertTitle: { fontSize: 19, fontWeight: '700', marginBottom: 10 },
  alertMessage: { fontSize: 15, lineHeight: 21, marginBottom: 8 },
  alertButtons: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 8 },
  alertButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, marginLeft: 4 },
  alertButtonText: { fontSize: 15, fontWeight: '700' },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 14, fontWeight: '600', paddingHorizontal: 20, paddingVertical: 10 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  sheetIcon: { marginRight: 22 },
  sheetText: { fontSize: 16 },
});
