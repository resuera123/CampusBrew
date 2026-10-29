import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { ChatService, ChatChannel, ChatMessage } from '../../services/ChatService';

/**
 * v2.0 FR-3.5 — order chat. Customers switch between the Shop and Dasher
 * conversations; shops and dashers open their own channel only.
 *
 * Sends are optimistic: the bubble shows "Sending" until the server echoes it back
 * (matched by clientId). A rejection ("chat:error") or no echo within 10s marks it
 * failed, and tapping it retries (NFR-R4). Frames sent while the socket is down are
 * queued by RealtimeSocket and flushed on reconnect.
 */

type LocalMessage = ChatMessage & { status?: 'sending' | 'failed'; error?: string };

const ACK_TIMEOUT_MS = 10_000;

const QUICK_REPLIES: Record<string, string[]> = {
  CUSTOMER: ["I'm at the lobby", 'On my way down', 'Thank you!'],
  DELIVERY_PERSONNEL: ["I'm on my way", "I'm at the drop-off", 'Running a bit late'],
  SHOP_OPERATOR: ['Noted!', 'Your order is almost ready', 'Sorry, that item is out of stock'],
};

export default function ChatScreen({ route, navigation }: any) {
  const { user, token } = useAuth();
  const { socket, connected } = useSocket();
  const orderId: string = route?.params?.orderId;
  const isCustomer = user?.role === 'CUSTOMER';
  const [channel, setChannel] = useState<ChatChannel>(route?.params?.channel ?? 'SHOP');

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [counterpartName, setCounterpartName] = useState('');
  const [writable, setWritable] = useState(false);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState('');

  const listRef = useRef<FlatList<LocalMessage>>(null);
  const ackTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Guards against a slow history response landing after the user switched tabs.
  const channelRef = useRef(channel);
  channelRef.current = channel;
  const wasConnected = useRef(connected);

  const markRead = useCallback(() => {
    socket?.emit('chat:read', { orderId, channel });
  }, [socket, orderId, channel]);

  const load = useCallback(async () => {
    if (!token || !orderId) return;
    try {
      const h = await ChatService.history(orderId, channel, token);
      if (channelRef.current !== channel) return;
      setCounterpartName(h.counterpartName);
      setWritable(h.writable);
      setClosedReason(h.closedReason ?? null);
      setReported(h.reported);
      // Keep local bubbles the server hasn't confirmed yet (sending / failed).
      setMessages((prev) => [...h.messages, ...prev.filter((m) => m.status)]);
      setLoadError(null);
      markRead();
    } catch (e: any) {
      setLoadError(e.message ?? 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [token, orderId, channel, markRead]);

  // Load on open / channel switch, and again after a reconnect to catch missed messages.
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    load();
  }, [channel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (connected && !wasConnected.current) load();
    wasConnected.current = connected;
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket) return;
    const forThisChat = (p: any) => p?.orderId === orderId && p?.channel === channel;

    const onMessage = (m: ChatMessage) => {
      if (!forThisChat(m)) return;
      if (m.clientId) {
        const t = ackTimers.current.get(m.clientId);
        if (t) clearTimeout(t);
        ackTimers.current.delete(m.clientId);
      }
      setMessages((prev) => {
        const withoutPending = prev.filter((x) => !(m.clientId && x.clientId === m.clientId && x.status));
        if (withoutPending.some((x) => x.id === m.id)) return withoutPending;
        return [...withoutPending, m];
      });
      if (m.senderId !== user?.userId) markRead();
    };

    const onRead = (r: { orderId: string; channel: ChatChannel; readAt: string }) => {
      if (!forThisChat(r)) return;
      setMessages((prev) =>
        prev.map((m) => (m.senderId === user?.userId && !m.readAt && !m.status ? { ...m, readAt: r.readAt } : m)),
      );
    };

    const onError = (e: { clientId?: string; error: string } & Record<string, any>) => {
      if (!forThisChat(e) || !e.clientId) return;
      failPending(e.clientId, e.error);
      // The channel closed while the screen was open — refresh its state.
      load();
    };

    // Delivery/cancellation can close the channel while it's open — refresh writability.
    const onStatus = (p: { orderId: string }) => {
      if (p?.orderId === orderId) load();
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:read', onRead);
    socket.on('chat:error', onError);
    socket.on('order:statusUpdate', onStatus);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:read', onRead);
      socket.off('chat:error', onError);
      socket.off('order:statusUpdate', onStatus);
    };
  }, [socket, orderId, channel, user?.userId, markRead, load]);

  // Clear any outstanding ack timers when leaving the screen.
  useEffect(() => () => ackTimers.current.forEach(clearTimeout), []);

  const failPending = (clientId: string, error?: string) => {
    const t = ackTimers.current.get(clientId);
    if (t) clearTimeout(t);
    ackTimers.current.delete(clientId);
    setMessages((prev) =>
      prev.map((m) => (m.clientId === clientId && m.status ? { ...m, status: 'failed', error } : m)),
    );
  };

  const emitMessage = (clientId: string, text: string) => {
    if (!socket) {
      failPending(clientId, 'Not connected');
      return;
    }
    socket.emit('chat:send', { orderId, channel, text, clientId });
    ackTimers.current.set(clientId, setTimeout(() => failPending(clientId, 'Not delivered'), ACK_TIMEOUT_MS));
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || !user) return;
    const clientId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMessages((prev) => [
      ...prev,
      {
        id: clientId,
        clientId,
        orderId,
        channel,
        senderId: user.userId,
        senderRole: user.role,
        text,
        createdAt: new Date().toISOString(),
        status: 'sending',
      },
    ]);
    setInput('');
    emitMessage(clientId, text);
  };

  const retry = (m: LocalMessage) => {
    if (!m.clientId) return;
    setMessages((prev) =>
      prev.map((x) => (x.clientId === m.clientId ? { ...x, status: 'sending', error: undefined } : x)),
    );
    emitMessage(m.clientId, m.text);
  };

  const confirmReport = () => {
    Alert.alert(
      'Report conversation',
      'This conversation will be kept for review by CampusBrew. Report it?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await ChatService.report(orderId, channel, token);
              setReported(true);
            } catch (e: any) {
              Alert.alert('Could not report', e.message ?? 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const lastMineId = [...messages].reverse().find((m) => m.senderId === user?.userId && !m.status)?.id;
  const quickReplies = QUICK_REPLIES[user?.role ?? 'CUSTOMER'] ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.topBarTitle} numberOfLines={1}>
              {counterpartName || (channel === 'SHOP' ? 'Chat with Shop' : 'Chat with Dasher')}
            </Text>
            <Text style={styles.topBarSub}>Order #{orderId?.slice(-6).toUpperCase()}</Text>
          </View>
          <TouchableOpacity style={styles.topBarIcon} onPress={confirmReport} disabled={reported}>
            <Ionicons name="flag-outline" size={20} color={reported ? COLORS.border : COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {isCustomer && (
          <View style={styles.tabs}>
            {(['DASHER', 'SHOP'] as ChatChannel[]).map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.tab, channel === c && styles.tabActive]}
                onPress={() => setChannel(c)}
              >
                <Text style={[styles.tabText, channel === c && styles.tabTextActive]}>
                  {c === 'SHOP' ? 'Shop' : 'Dasher'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={load}>
              <Text style={styles.retryLink}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {writable ? 'No messages yet. Say hi!' : 'No messages in this conversation.'}
              </Text>
            }
            renderItem={({ item }) => (
              <Bubble
                message={item}
                mine={item.senderId === user?.userId}
                showReceipt={item.id === lastMineId}
                onRetry={() => retry(item)}
              />
            )}
          />
        )}

        {reported && (
          <Text style={styles.noteText}>You reported this conversation. It will be kept for review.</Text>
        )}

        {!loading && !loadError && (writable ? (
          <View>
            <View style={styles.quickRow}>
              {quickReplies.map((q) => (
                <TouchableOpacity key={q} style={styles.quickChip} onPress={() => send(q)}>
                  <Text style={styles.quickText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Type a message…"
                placeholderTextColor={COLORS.textSecondary}
                maxLength={500}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                onPress={() => send(input)}
                disabled={!input.trim()}
              >
                <Ionicons name="send" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.closedBar}>
            <Ionicons name="lock-closed-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.closedText}>{closedReason ?? 'This conversation is read-only.'}</Text>
          </View>
        ))}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({
  message,
  mine,
  showReceipt,
  onRetry,
}: {
  message: LocalMessage;
  mine: boolean;
  showReceipt: boolean;
  onRetry: () => void;
}) {
  const failed = message.status === 'failed';
  return (
    <View style={[styles.bubbleWrap, mine ? styles.wrapMine : styles.wrapTheirs]}>
      <TouchableOpacity
        activeOpacity={failed ? 0.6 : 1}
        disabled={!failed}
        onPress={onRetry}
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, failed && styles.bubbleFailed]}
      >
        <Text style={mine ? styles.textMine : styles.textTheirs}>{message.text}</Text>
      </TouchableOpacity>
      {message.status === 'sending' && <Text style={styles.meta}>Sending…</Text>}
      {failed && (
        <Text style={[styles.meta, styles.metaFailed]}>
          {message.error ? `${message.error} · ` : ''}Tap to retry
        </Text>
      )}
      {!message.status && (showReceipt || !mine) && (
        <Text style={styles.meta}>
          {mine && message.readAt ? `Read ${formatTime(message.readAt)}` : formatTime(message.createdAt)}
        </Text>
      )}
    </View>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.screenPadding },
  topBar: {
    height: 56,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  topBarIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  topBarSub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SIZES.screenPadding,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: SIZES.captionSize, color: COLORS.text },
  tabTextActive: { color: COLORS.white, fontWeight: '600' },
  list: { padding: SIZES.screenPadding, flexGrow: 1 },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 32, fontSize: SIZES.captionSize },
  errorText: { color: '#D93025', textAlign: 'center' },
  retryLink: { color: COLORS.primary, fontWeight: '600', marginTop: 8 },
  bubbleWrap: { marginBottom: 10, maxWidth: '80%' },
  wrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  wrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  bubbleMine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  bubbleFailed: { opacity: 0.6 },
  textMine: { color: COLORS.white, fontSize: SIZES.captionSize },
  textTheirs: { color: COLORS.text, fontSize: SIZES.captionSize },
  meta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  metaFailed: { color: '#D93025' },
  noteText: {
    fontSize: SIZES.smallSize,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SIZES.screenPadding,
    paddingBottom: 6,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: SIZES.screenPadding,
    paddingTop: 8,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickText: { fontSize: SIZES.smallSize, color: COLORS.text },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: SIZES.captionSize,
    color: COLORS.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  closedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  closedText: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
});
