import React, { useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * App-wide replacement for Alert.alert, drawn with the app's ConfirmDialog.
 * Same call shape — showAlert(title, message?, buttons?) — so any screen (or
 * non-screen code) can use it without wiring a dialog in. <AppAlertHost/> is
 * mounted once in App.tsx; alerts raised while one is showing wait their turn.
 */

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface Pending {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

const queue: Pending[] = [];
let notify: (() => void) | null = null;

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  queue.push({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
  notify?.();
}

/** Picks an icon from the wording: errors, successes, or plain information. */
function iconFor(title: string): string {
  const t = title.toLowerCase();
  if (/(error|fail|could not|couldn't|did not|not completed|suspended|invalid|required|empty|match)/.test(t)) {
    return 'alert-circle-outline';
  }
  if (/(success|sent|verified|confirmed|recorded|reported|thanks|done|updated)/.test(t)) {
    return 'checkmark-circle-outline';
  }
  return 'information-circle-outline';
}

export function AppAlertHost() {
  const [current, setCurrent] = useState<Pending | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    notify = () => {
      setCurrent((showing) => {
        if (showing) return showing;
        const next = queue.shift() ?? null;
        if (next) setVisible(true);
        return next;
      });
    };
    notify();
    return () => {
      notify = null;
    };
  }, []);

  const close = (button?: AlertButton) => {
    setVisible(false);
    setCurrent(null);
    button?.onPress?.();
    // Show the next queued alert after this one has faded.
    setTimeout(() => notify?.(), 250);
  };

  const buttons = current?.buttons ?? [];
  const cancel = buttons.length > 1 ? buttons.find((b) => b.style === 'cancel') : undefined;
  const confirm = buttons.find((b) => b !== cancel) ?? buttons[0];

  return (
    <ConfirmDialog
      visible={visible && current != null}
      title={current?.title ?? ''}
      message={current?.message}
      icon={current ? iconFor(current.title) : undefined}
      confirmLabel={confirm?.text ?? 'OK'}
      cancelLabel={cancel?.text ?? 'Cancel'}
      hideCancel={!cancel}
      destructive={confirm?.style === 'destructive'}
      onConfirm={() => close(confirm)}
      onCancel={() => close(cancel)}
    />
  );
}
