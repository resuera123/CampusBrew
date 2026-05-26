import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { ShopService, MenuItem } from '../../services/ShopService';

interface Props {
  visible: boolean;
  shopId: string;
  item: MenuItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ItemEditorModal({ visible, shopId, item, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setPrice(String(item.price));
      setDescription(item.description ?? '');
      setCategory(item.category ?? '');
      setImage(item.image ?? '');
      setIsAvailable(item.isAvailable ?? true);
    } else {
      setName('');
      setPrice('');
      setDescription('');
      setCategory('');
      setImage('');
      setIsAvailable(true);
    }
  }, [item, visible]);

  const handleSave = async () => {
    if (!token) return;
    const priceNum = parseFloat(price);
    if (!name.trim()) return Alert.alert('Validation', 'Name is required');
    if (Number.isNaN(priceNum) || priceNum < 0) return Alert.alert('Validation', 'Enter a valid price');
    if (!category.trim()) return Alert.alert('Validation', 'Category is required');

    setSaving(true);
    try {
      if (item) {
        await ShopService.updateMenuItem(
          item.id,
          {
            name: name.trim(),
            price: priceNum,
            description: description.trim() || undefined,
            category: category.trim(),
            image: image.trim() || undefined,
            isAvailable,
          },
          token,
        );
      } else {
        await ShopService.createMenuItem(
          {
            shopId,
            name: name.trim(),
            price: priceNum,
            description: description.trim() || undefined,
            category: category.trim(),
            image: image.trim() || undefined,
            isAvailable,
          },
          token,
        );
      }
      onSaved();
    } catch (e: any) {
      Alert.alert('Save failed', e.message || 'Could not save item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBarIcon} onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>{item ? 'Edit Item' : 'New Item'}</Text>
          <View style={styles.topBarIcon} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Field label="Item Name *" value={name} onChangeText={setName} placeholder="e.g. Iced Caramel Latte" />
          <Field label="Price (₱) *" value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" />
          <Field label="Category *" value={category} onChangeText={setCategory} placeholder="Coffee, Milk Tea, ..." />
          <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optional" multiline />
          <Field label="Image URL" value={image} onChangeText={setImage} placeholder="https://..." />

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.label}>Available</Text>
              <Text style={styles.toggleSub}>
                Customers can {isAvailable ? 'see and order' : 'not order'} this item
              </Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ true: COLORS.primary, false: COLORS.border }}
              thumbColor={COLORS.white}
            />
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.saveBtnText}>{item ? 'Save Changes' : 'Add to Menu'}</Text>}
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
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
