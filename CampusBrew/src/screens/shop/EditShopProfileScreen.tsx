import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { ShopService } from '../../services/ShopService';
import { pickPhoto } from '../../utils/photos';

// Shop photos travel with every shop list, so they're kept small.
const SHOP_PHOTO_SIDE = 600;

export default function EditShopProfileScreen({ route, navigation }: any) {
  const { token } = useAuth();
  const [shopId, setShopId] = useState<string | undefined>(route?.params?.shopId);
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [shopImage, setShopImage] = useState('');
  const [estimatedPrepTime, setEstimatedPrepTime] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  // A shop can't open until an admin approves its application.
  const [approved, setApproved] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  const choosePhoto = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      setProcessingPhoto(true);
      const uri = await pickPhoto(source, 'back', SHOP_PHOTO_SIDE);
      if (uri) setShopImage(uri);
    } catch (e: any) {
      setError(e.message || 'Could not add the photo');
    } finally {
      setProcessingPhoto(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      try {
        const shop = await ShopService.getMyShop(token);
        if (cancelled) return;
        setShopId(shop.id);
        setShopName(shop.shopName ?? '');
        setDescription(shop.description ?? '');
        setLocation(shop.location ?? '');
        setShopImage(shop.shopImage ?? '');
        setEstimatedPrepTime(shop.estimatedPrepTime ?? '');
        setOpenTime(shop.operatingHours?.openTime ?? '');
        setCloseTime(shop.operatingHours?.closeTime ?? '');
        setIsOpen(!!shop.isOpen);
        setApproved(shop.approved !== false);
      } catch (e: any) {
        setError(e.message || 'Could not load shop');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSave = async () => {
    setError(null);
    if (!token || !shopId) {
      setError('Not signed in. Please log in again.');
      return;
    }
    if (!shopName.trim()) {
      setError('Shop name is required.');
      return;
    }

    setSaving(true);
    try {
      await ShopService.updateShop(
        shopId,
        {
          shopName: shopName.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          // An empty string clears the photo.
          shopImage: shopImage,
          estimatedPrepTime: estimatedPrepTime.trim() || undefined,
          operatingHours:
            openTime || closeTime ? { openTime: openTime.trim(), closeTime: closeTime.trim() } : undefined,
          isOpen,
        },
        token,
      );
      navigation.goBack();
    } catch (e: any) {
      setError(e.message || 'Could not save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Edit Shop</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#D93025" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <Field label="Shop Name *" value={shopName} onChangeText={setShopName} />
        <Field label="Description" value={description} onChangeText={setDescription} multiline />
        <Field label="Location" value={location} onChangeText={setLocation} />
        <Text style={styles.photoLabel}>Shop Photo</Text>
        <View style={styles.photoRow}>
          <View style={styles.photoBox}>
            {processingPhoto ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : shopImage ? (
              <Image source={{ uri: shopImage }} style={styles.photo} />
            ) : (
              <Ionicons name="storefront-outline" size={30} color={COLORS.textSecondary} />
            )}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.photoHint}>Customers see this on your shop card. A clear photo of your stall or drinks works best.</Text>
            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoBtn} onPress={() => choosePhoto('camera')} disabled={processingPhoto}>
                <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
                <Text style={styles.photoBtnText}>Take photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={() => choosePhoto('library')} disabled={processingPhoto}>
                <Ionicons name="images-outline" size={16} color={COLORS.primary} />
                <Text style={styles.photoBtnText}>Upload</Text>
              </TouchableOpacity>
              {!!shopImage && (
                <TouchableOpacity style={[styles.photoBtn, styles.photoBtnRemove]} onPress={() => setShopImage('')} disabled={processingPhoto}>
                  <Ionicons name="trash-outline" size={16} color="#D93025" />
                  <Text style={[styles.photoBtnText, { color: '#D93025' }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <Field
          label="Estimated Prep Time"
          value={estimatedPrepTime}
          onChangeText={setEstimatedPrepTime}
          placeholder="e.g. 15-20 min"
        />

        <View style={styles.hoursRow}>
          <View style={{ flex: 1 }}>
            <Field label="Open Time" value={openTime} onChangeText={setOpenTime} placeholder="08:00" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Close Time" value={closeTime} onChangeText={setCloseTime} placeholder="20:00" />
          </View>
        </View>

        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.label}>Shop Open</Text>
            <Text style={styles.toggleSub}>
              {!approved
                ? 'Available once an admin approves your shop'
                : isOpen ? 'Accepting orders' : 'Not accepting orders'}
            </Text>
          </View>
          <Switch
            value={isOpen}
            onValueChange={setIsOpen}
            disabled={!approved}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
            thumbColor={COLORS.white}
          />
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving || processingPhoto}>
        {saving
          ? <ActivityIndicator color={COLORS.white} />
          : <Text style={styles.saveBtnText}>Save Changes</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function Field({
  label,
  multiline,
  ...rest
}: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        style={[styles.input, multiline && styles.inputMulti]}
        placeholderTextColor={COLORS.textSecondary}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoLabel: { fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  photoBox: { width: 88, height: 88, borderRadius: 10, backgroundColor: COLORS.backgroundSecondary, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  photo: { width: '100%', height: '100%' },
  photoHint: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, lineHeight: 17 },
  photoButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: COLORS.primary },
  photoBtnRemove: { borderColor: '#D93025' },
  photoBtnText: { fontSize: SIZES.smallSize, color: COLORS.primary, fontWeight: '600' },
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
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FCE8E8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { color: '#D93025', fontSize: SIZES.smallSize, flex: 1 },
  field: { marginBottom: 16 },
  label: { fontSize: SIZES.captionSize, color: COLORS.text, fontWeight: '500', marginBottom: 6 },
  input: {
    height: SIZES.inputHeight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.inputBorderRadius,
    paddingHorizontal: 12,
    fontSize: SIZES.inputFontSize,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  inputMulti: { height: 80, paddingTop: 10, textAlignVertical: 'top' },
  hoursRow: { flexDirection: 'row', gap: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.backgroundSecondary,
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  toggleSub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  saveBtn: {
    margin: SIZES.screenPadding,
    height: SIZES.buttonHeight,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: { color: COLORS.white, fontSize: SIZES.buttonFontSize, fontWeight: '600' },
});
