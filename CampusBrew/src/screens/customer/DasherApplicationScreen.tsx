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
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmDialog';
import { DasherApplicationService } from '../../services/DasherApplicationService';

/**
 * Become a Dasher — a verified customer's application, reviewed by an admin.
 * Photos are shrunk to ~1024 px JPEGs on the phone before upload.
 */

type PhotoKey = 'idPhoto' | 'selfiePhoto' | 'corPhoto';

const PHOTOS: { key: PhotoKey; label: string; hint: string; camera: 'front' | 'back' }[] = [
  { key: 'idPhoto', label: 'CIT-U ID', hint: 'Front of your school ID, all text readable', camera: 'back' },
  { key: 'selfiePhoto', label: 'Selfie holding your ID', hint: 'Your face and the ID both visible', camera: 'front' },
  { key: 'corPhoto', label: 'Certificate of Registration', hint: "This term's COR", camera: 'back' },
];

const RULES = [
  'Hand over orders on time and in the condition the shop packed them.',
  'Collect and turn over cash (COD) exactly as recorded in the app.',
  'Keep chats respectful; never share customers’ details outside the app.',
  'Only accept deliveries you can actually complete.',
];

const MOBILE = /^(09|\+639)\d{9}$/;

export default function DasherApplicationScreen({ navigation }: any) {
  const { token } = useAuth();
  const { notify, dialog } = useConfirm();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [photos, setPhotos] = useState<Record<PhotoKey, string | null>>({
    idPhoto: null,
    selfiePhoto: null,
    corPhoto: null,
  });
  const [processing, setProcessing] = useState<PhotoKey | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickPhoto = async (key: PhotoKey, source: 'camera' | 'library', camera: 'front' | 'back') => {
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        notify('Permission needed', `Allow ${source === 'camera' ? 'camera' : 'photo'} access to add this photo.`, {
          icon: 'lock-closed-outline',
        });
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 1,
        cameraType: camera === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]) return;

      setProcessing(key);
      const asset = result.assets[0];
      const resize = asset.width >= asset.height ? { width: 1024 } : { height: 1024 };
      const small = await manipulateAsync(asset.uri, [{ resize }], {
        compress: 0.6,
        format: SaveFormat.JPEG,
        base64: true,
      });
      setPhotos((prev) => ({ ...prev, [key]: `data:image/jpeg;base64,${small.base64}` }));
    } catch (e: any) {
      notify('Could not add photo', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setProcessing(null);
    }
  };

  /** First problem with the form, checked here so the user gets it before uploading. */
  const problem = (): string | null => {
    if (!MOBILE.test(phoneNumber.trim())) return 'Enter your mobile number as 09XXXXXXXXX.';
    if (!course.trim()) return 'Enter your course.';
    if (!yearLevel) return 'Pick your year level.';
    const r = reason.trim().length;
    if (r < 20 || r > 500) return 'Tell us why you want to be a dasher (20 to 500 characters).';
    if (!emergencyName.trim() || !emergencyRelationship.trim()) {
      return "Enter your emergency contact's name and relationship.";
    }
    if (!MOBILE.test(emergencyPhone.trim())) return "Enter your emergency contact's number as 09XXXXXXXXX.";
    if (emergencyPhone.trim() === phoneNumber.trim()) return 'Your emergency contact needs a different number from yours.';
    const missing = PHOTOS.find((p) => !photos[p.key]);
    if (missing) return `Add a photo: ${missing.label}.`;
    if (!agreed) return 'You need to agree to the dasher code of conduct.';
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
      await DasherApplicationService.apply(
        {
          phoneNumber: phoneNumber.trim(),
          course: course.trim(),
          yearLevel: yearLevel!,
          reason: reason.trim(),
          emergencyName: emergencyName.trim(),
          emergencyRelationship: emergencyRelationship.trim(),
          emergencyPhone: emergencyPhone.trim(),
          agreedToRules: agreed,
          idPhoto: photos.idPhoto!,
          selfiePhoto: photos.selfiePhoto!,
          corPhoto: photos.corPhoto!,
        },
        token,
      );
      await notify('Application sent', "An admin will review it. We'll notify you when there's a decision.", {
        icon: 'checkmark-circle-outline',
        confirmLabel: 'Done',
      });
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
        <Text style={styles.topBarTitle}>Become a Dasher</Text>
        <View style={styles.topBarIcon} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Deliver drinks around campus between classes. An admin checks every application, so make sure your
            photos are clear.
          </Text>

          <Section title="About you">
            <Field label="Mobile number" value={phoneNumber} onChange={setPhoneNumber} placeholder="09XXXXXXXXX" phone />
            <Field label="Course" value={course} onChange={setCourse} placeholder="e.g. BSIT" />
            <Text style={styles.label}>Year level</Text>
            <View style={styles.chips}>
              {[1, 2, 3, 4, 5].map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.chip, yearLevel === y && styles.chipOn]}
                  onPress={() => setYearLevel(y)}
                >
                  <Text style={[styles.chipText, yearLevel === y && styles.chipTextOn]}>{ordinal(y)} year</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Why do you want to be a dasher?</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={reason}
              onChangeText={setReason}
              placeholder="A few sentences (at least 20 characters)"
              placeholderTextColor={COLORS.textSecondary}
              maxLength={500}
              multiline
            />
            <Text style={styles.counter}>{reason.trim().length}/500</Text>
          </Section>

          <Section title="Emergency contact">
            <Field label="Name" value={emergencyName} onChange={setEmergencyName} placeholder="Full name" />
            <Field
              label="Relationship"
              value={emergencyRelationship}
              onChange={setEmergencyRelationship}
              placeholder="e.g. Mother, Guardian"
            />
            <Field label="Mobile number" value={emergencyPhone} onChange={setEmergencyPhone} placeholder="09XXXXXXXXX" phone />
          </Section>

          <Section title="Photos">
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
                    <TouchableOpacity
                      style={styles.photoBtn}
                      onPress={() => pickPhoto(p.key, 'camera', p.camera)}
                      disabled={processing != null}
                    >
                      <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.photoBtnText}>Take photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.photoBtn}
                      onPress={() => pickPhoto(p.key, 'library', p.camera)}
                      disabled={processing != null}
                    >
                      <Ionicons name="images-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.photoBtnText}>Choose</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </Section>

          <Section title="Dasher code of conduct">
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
              <Text style={styles.agreeText}>I agree to follow the dasher code of conduct.</Text>
            </TouchableOpacity>
          </Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
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

function ordinal(n: number) {
  return ['1st', '2nd', '3rd', '4th', '5th'][n - 1];
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: SIZES.smallSize, color: COLORS.text },
  chipTextOn: { color: COLORS.white, fontWeight: '600' },
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
