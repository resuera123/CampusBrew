import React, { useCallback, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  /** Confirm button label. Default "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Default "Cancel". */
  cancelLabel?: string;
  /** Whether the confirm action is destructive (red button). */
  destructive?: boolean;
  /** Optional ionicon name shown at the top of the dialog. */
  icon?: any;
  /** One-button notice (no Cancel), e.g. "Thanks for rating!". */
  hideCancel?: boolean;
  /** Disables both buttons while an async action is running. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Centered confirm dialog with proper button callbacks (Alert.alert button
 * onPress handlers silently drop on Expo Web). Use this for any destructive
 * or auth-sensitive action like logout, cancel order, delete item, etc.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  icon,
  hideCancel = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => { if (!busy) onCancel(); }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {icon && (
            <View style={[styles.iconWrap, destructive && styles.iconWrapDestructive]}>
              <Ionicons name={icon} size={28} color={destructive ? '#D93025' : COLORS.primary} />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.actions}>
            {!hideCancel && (
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={onCancel}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btn, destructive ? styles.destructiveBtn : styles.confirmBtn]}
              onPress={onConfirm}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.confirmText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type ConfirmOptions = Omit<Props, 'visible' | 'busy' | 'onConfirm' | 'onCancel'>;

/**
 * Promise-style ConfirmDialog for one-off confirmations:
 *   const { confirm, dialog } = useConfirm();
 *   if (await confirm({ title: 'Delete item?', destructive: true })) { ... }
 * Render `{dialog}` once anywhere in the screen. `notify` is the one-button
 * version for messages; it resolves when the user taps OK.
 */
export function useConfirm() {
  // Options stay set after closing so the text doesn't blank out during the fade.
  const [options, setOptions] = useState<ConfirmOptions>({ title: '' });
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const notify = useCallback(
    (title: string, message?: string, opts?: Partial<ConfirmOptions>) =>
      confirm({ title, message, confirmLabel: 'OK', ...opts, hideCancel: true }).then(() => {}),
    [confirm],
  );

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  };

  const dialog = (
    <ConfirmDialog
      {...options}
      visible={open}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, notify, dialog };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  iconWrapDestructive: { backgroundColor: '#FCE8E8' },
  title: {
    fontSize: SIZES.bodySize,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  message: {
    fontSize: SIZES.captionSize,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: { backgroundColor: COLORS.backgroundSecondary },
  cancelText: { color: COLORS.text, fontWeight: '600', fontSize: SIZES.captionSize },
  confirmBtn: { backgroundColor: COLORS.primary },
  destructiveBtn: { backgroundColor: '#D93025' },
  confirmText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.captionSize },
});
