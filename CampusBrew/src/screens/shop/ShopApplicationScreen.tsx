import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmDialog';
import { ShopApplicationService } from '../../services/ShopApplicationService';
import { pickPhoto } from '../../utils/photos';

/**
 * Shop approval application: what an admin checks before a new shop can open
 * and appear to customers. Mirrors the Become a Dasher form.
 */

type PhotoKey = 'stallPhoto' | 'idPhoto';

const PHOTOS: { key: PhotoKey; label: string; hint: string }[] = [
  { key: 'stallPhoto', label: 'Your stall', hint: 'The counter or signage, so customers and dashers can find it' },
  { key: 'idPhoto', label: 'Valid ID', hint: "The operator's government or school ID, name readable" },
];

const RULES = [
  'Prepare every paid order, or cancel it promptly so the customer is refunded.',
  'Keep menu items, prices and availability accurate.',
  'Have orders ready for the dasher at the time you mark them ready.',
  'Keep chats with customers and dashers respectful.',
];

const MOBILE = /^(09|\+639)\d{9}$/;

export default function ShopApplicationScreen({ navigation }: any) {
  const { token, user } = useAuth();
  const { notify, dialog } = useConfirm();
  const [stallName, setStallName] = useState('');
  const [location, setLocation] = useState('');
  const [operatorName, setOperatorName] = useState(user?.fullName ?? '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [photos, setPhotos] = useState<Record<PhotoKey, string | null>>({ stallPhoto: null, idPhoto: null });
  const [processing, setProcessing] = useState<PhotoKey | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const addPhoto = async (key: PhotoKey, source: 'camera' | 'library') => {
    try {
      setProcessing(key);
      const uri = await pickPhoto(source);
      if (uri) setPhotos((prev) => ({ ...prev, [key]: uri }));
    } catch (e: any) {
      notify('Could not add photo', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setProcessing(null);
    }
  };

  const problem = (): string | null => {
    if (!stallName.trim()) return 'Enter your stall or business name.';
    if (!location.trim()) return 'Enter where your stall is on campus.';
    if (!operatorName.trim()) return "Enter the operator's full name.";
    if (!MOBILE.test(phoneNumber.trim())) return 'Enter your mobile number as 09XXXXXXXXX.';
    const missing = PHOTOS.find((p) => !photos[p.key]);
    if (missing) return `Add a photo: ${missing.label}.`;
    if (!agreed) return 'You need to agree to the shop rules.';
    return null;
  };

  const submit = async () => {
    if (!token) return;
    const issue = problem();
    if (issue) {
      notify('Almost there', issue, { icon: 'information-circle-outline' });
      return;
    }
    setSubmitting(true);
    try {
      await ShopApplicationService.apply(
        {
          stallName: stallName.trim(),
          location: location.trim(),
          operatorName: operatorName.trim(),
          phoneNumber: phoneNumber.trim(),
          agreedToRules: agreed,
          stallPhoto: photos.stallPhoto!,
          idPhoto: photos.idPhoto!,
        },
        token,
      );
      await notify(
        'Application sent',
        "An admin will review it. Meanwhile you can set up your menu — customers will see your shop once it's approved.",
        { icon: 'checkmark-circle-outline', confirmLabel: 'Done' },
      );
      navigation.goBack();
    } catch (e: any) {
      notify('Could not submit', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Shop Approval</Text>
        <View style={styles.topBarIcon} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            An admin checks every new shop before customers can see it. Once approved, your shop takes the name
            and location below, and you can open it for orders.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your shop</Text>
            <Field label="Stall / business name" value={stallName} onChange={setStallName} placeholder="e.g. Pickup Coffee" />
            <Field
              label="Location on campus"
              value={location}
              onChange={setLocation}
              placeholder="e.g. GLE Building canteen, stall 4"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Operator</Text>
            <Field label="Full name" value={operatorName} onChange={setOperatorName} placeholder="Full name" />
            <Field label="Mobile number" value={phoneNumber} onChange={setPhoneNumber} placeholder="09XXXXXXXXX" phone />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Photos</Text>
            {PHOTOS.map((p) => (
              <View key={p.key} style={styles.photoRow}>
                <View style={styles.photoBox}>
                  {processing === p.key ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : photos[p.key] ? (
                    <Image source={{ uri: photos[p.key]! }} style={styles.photo} />
                  ) : (
                    <Ionicons name="image-outline" size={28} color={COLORS.textSecondary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.photoLabel}>
                    {p.label} {photos[p.key] && <Ionicons name="checkmark-circle" size={14} color="#1E8E3E" />}
                  </Text>
                  <Text style={styles.photoHint}>{p.hint}</Text>
                  <View style={styles.photoButtons}>
                    <TouchableOpacity style={styles.photoBtn} onPress={() => addPhoto(p.key, 'camera')} disabled={processing != null}>
                      <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.photoBtnText}>Take photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoBtn} onPress={() => addPhoto(p.key, 'library')} disabled={processing != null}>
                      <Ionicons name="images-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.photoBtnText}>Choose</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shop rules</Text>
            {RULES.map((rule) => (
              <View key={rule} style={styles.ruleRow}>
                <Text style={styles.ruleDot}>•</Text>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreed((a) => !a)} activeOpacity={0.7}>
              <Ionicons
                name={agreed ? 'checkbox' : 'square-outline'}
                size={22}
                color={agreed ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={styles.agreeText}>I agree to follow the CampusBrew shop rules.</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || processing != null) && { opacity: 0.6 }]}
          onPress={submit}
          disabled={submitting || processing != null}
        >
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Submit Application</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
      {dialog}
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  phone,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  phone?: boolean;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        keyboardType={phone ? 'phone-pad' : 'default'}
        maxLength={phone ? 13 : 80}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
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
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  content: { padding: SIZES.screenPadding, paddingBottom: 24 },
  intro: { fontSize: SIZES.captionSize, color: COLORS.textSecondary, marginBottom: 12, lineHeight: 20 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  label: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: SIZES.captionSize,
    color: COLORS.text,
  },
  photoRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  photoBox: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoLabel: { fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  photoHint: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  photoButtons: { flexDirection: 'row', gap: 8, marginTop: 6 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  photoBtnText: { fontSize: SIZES.smallSize, color: COLORS.primary, fontWeight: '600' },
  ruleRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  ruleDot: { color: COLORS.textSecondary },
  ruleText: { flex: 1, fontSize: SIZES.smallSize, color: COLORS.text, lineHeight: 18 },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  agreeText: { flex: 1, fontSize: SIZES.captionSize, color: COLORS.text },
  submitBtn: {
    height: SIZES.buttonHeight,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SIZES.screenPadding,
    marginBottom: 12,
  },
  submitText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
