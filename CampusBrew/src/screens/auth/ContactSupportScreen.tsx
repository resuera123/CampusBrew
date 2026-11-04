import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SupportService, SupportTopic } from '../../services/SupportService';
import { showAlert } from '../../components/AppAlert';
import { COLORS, SIZES } from '../../constants/theme';

const TOPICS: { value: SupportTopic; label: string; icon: any }[] = [
  { value: 'APPEAL', label: 'Appeal a suspension', icon: 'shield-checkmark-outline' },
  { value: 'QUESTION', label: 'Question', icon: 'help-circle-outline' },
  { value: 'OTHER', label: 'Something else', icon: 'chatbubble-ellipses-outline' },
];
const MAX_MESSAGE = 1000;
const DANGER = '#D93025';

/**
 * Contact Support, reachable from the login screen without an account, so a
 * suspended user can appeal. Messages land in the admin panel's Support tab.
 */
export default function ContactSupportScreen({ navigation, route }: any) {
  const [email, setEmail] = useState<string>(route?.params?.email ?? '');
  const [name, setName] = useState('');
  const [topic, setTopic] = useState<SupportTopic>(route?.params?.topic ?? 'QUESTION');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ email?: string; message?: string }>({});
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = 'Enter the email you use for CampusBrew';
    if (message.trim().length < 10) next.message = 'Tell us a little more (at least 10 characters)';
    setErrors(next);
    if (next.email || next.message) return;

    setSending(true);
    try {
      const ref = await SupportService.submit({ email, name: name.trim() || undefined, topic, message: message.trim() });
      showAlert(
        'Message sent',
        `${ref ? `Your reference is ${ref}. ` : ''}We'll reply to ${email} as soon as we can.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      showAlert('Could not send', e.message ?? 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Contact Support</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.description}>
            Questions, problems, or appealing a suspended account: send us a message and we'll get back to you by email.
          </Text>

          <Text style={styles.label}>What is it about?</Text>
          <View style={styles.topics}>
            {TOPICS.map((t) => {
              const on = topic === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.topic, on && styles.topicOn]}
                  onPress={() => setTopic(t.value)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={t.icon} size={18} color={on ? COLORS.white : COLORS.primary} />
                  <Text style={[styles.topicText, on && styles.topicTextOn]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputContainer, !!errors.email && styles.inputError]}>
            <Ionicons name="mail-outline" size={20} color={errors.email ? DANGER : COLORS.textSecondary} style={{ marginRight: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={(t) => {
                setEmail(t.replace(/\s/g, ''));
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          {!!errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          <Text style={styles.label}>Name (optional)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={{ marginRight: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={COLORS.textSecondary}
              value={name}
              onChangeText={setName}
            />
          </View>

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.textArea, !!errors.message && styles.inputError]}
            placeholder={topic === 'APPEAL'
              ? 'Tell us why your account should be restored.'
              : 'How can we help?'}
            placeholderTextColor={COLORS.textSecondary}
            value={message}
            onChangeText={(t) => {
              setMessage(t);
              if (errors.message) setErrors((e) => ({ ...e, message: undefined }));
            }}
            multiline
            maxLength={MAX_MESSAGE}
            textAlignVertical="top"
          />
          <View style={styles.messageFooter}>
            <Text style={styles.errorText}>{errors.message ?? ''}</Text>
            <Text style={styles.counter}>{message.length}/{MAX_MESSAGE}</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, sending && styles.buttonDisabled]}
            onPress={submit}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Send message</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  topBar: { height: 56, backgroundColor: COLORS.background, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: COLORS.espresso },
  content: { paddingHorizontal: SIZES.screenPadding, paddingTop: 20, paddingBottom: 40 },
  description: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 21, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 18, marginBottom: 8 },
  topics: { gap: 8 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, borderRadius: SIZES.smallRadius, paddingHorizontal: 14, height: 46 },
  topicOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  topicText: { fontSize: 15, color: COLORS.text },
  topicTextOn: { color: COLORS.white, fontWeight: '600' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: SIZES.inputHeight, borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.smallRadius, backgroundColor: COLORS.white, paddingHorizontal: 16 },
  inputError: { borderColor: DANGER, borderWidth: 1.5, backgroundColor: '#FFF6F5' },
  input: { flex: 1, height: SIZES.inputHeight, fontSize: SIZES.inputFontSize, color: COLORS.text },
  textArea: { minHeight: 130, borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.smallRadius, backgroundColor: COLORS.white, padding: 14, fontSize: 15, color: COLORS.text },
  messageFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 20 },
  counter: { fontSize: 12, color: COLORS.textSecondary },
  errorText: { fontSize: 12, color: DANGER, marginTop: 4, flexShrink: 1 },
  button: { backgroundColor: COLORS.primary, borderRadius: SIZES.buttonBorderRadius, height: SIZES.buttonHeight, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.white, fontSize: SIZES.buttonFontSize, fontWeight: '600' },
});
