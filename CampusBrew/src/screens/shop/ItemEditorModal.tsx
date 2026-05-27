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
import {
  ShopService,
  MenuItem,
  CustomizationOptions,
  SizeOption,
  AddOnOption,
} from '../../services/ShopService';

interface Props {
  visible: boolean;
  shopId: string;
  item: MenuItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_SIZES: SizeOption[] = [
  { label: 'Small', priceModifier: 0 },
  { label: 'Medium', priceModifier: 10 },
  { label: 'Large', priceModifier: 20 },
];
const DEFAULT_SUGAR = ['0%', '25%', '50%', '75%', '100%'];
const DEFAULT_TEMPS = ['Regular', 'Extra Cold'];

// Trim empty rows + drop the whole options object if nothing is set so the
// CustomizeItemScreen falls back to "no customization" rather than rendering
// empty pill groups.
function normalize(opts: CustomizationOptions): CustomizationOptions | undefined {
  const sizes = (opts.sizes ?? []).filter((s) => s.label.trim());
  const sugarLevels = (opts.sugarLevels ?? []).map((s) => s.trim()).filter(Boolean);
  const temperatures = (opts.temperatures ?? []).map((s) => s.trim()).filter(Boolean);
  const addOns = (opts.addOns ?? []).filter((a) => a.name.trim());
  const empty = !sizes.length && !sugarLevels.length && !temperatures.length && !addOns.length;
  if (empty) return undefined;
  return { sizes, sugarLevels, temperatures, addOns };
}

export default function ItemEditorModal({ visible, shopId, item, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [sugarLevels, setSugarLevels] = useState<string[]>([]);
  const [temperatures, setTemperatures] = useState<string[]>([]);
  const [addOns, setAddOns] = useState<AddOnOption[]>([]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setPrice(String(item.price));
      setDescription(item.description ?? '');
      setCategory(item.category ?? '');
      setImage(item.image ?? '');
      setIsAvailable(item.isAvailable ?? true);
      const c = item.customizationOptions;
      setSizes(c?.sizes ?? []);
      setSugarLevels(c?.sugarLevels ?? []);
      setTemperatures(c?.temperatures ?? []);
      setAddOns(c?.addOns ?? []);
    } else {
      setName('');
      setPrice('');
      setDescription('');
      setCategory('');
      setImage('');
      setIsAvailable(true);
      setSizes([]);
      setSugarLevels([]);
      setTemperatures([]);
      setAddOns([]);
    }
  }, [item, visible]);

  const applyDefaults = () => {
    setSizes(DEFAULT_SIZES);
    setSugarLevels(DEFAULT_SUGAR);
    setTemperatures(DEFAULT_TEMPS);
  };

  const clearAllOptions = () => {
    setSizes([]);
    setSugarLevels([]);
    setTemperatures([]);
    setAddOns([]);
  };

  const handleSave = async () => {
    if (!token) return;
    const priceNum = parseFloat(price);
    if (!name.trim()) return Alert.alert('Validation', 'Name is required');
    if (Number.isNaN(priceNum) || priceNum < 0) return Alert.alert('Validation', 'Enter a valid price');
    if (!category.trim()) return Alert.alert('Validation', 'Category is required');

    const customizationOptions = normalize({ sizes, sugarLevels, temperatures, addOns });

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
            customizationOptions,
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
            customizationOptions,
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

          {/* ── Customization Options ───────────────────────────── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Customization Options</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={applyDefaults} style={styles.linkBtnGold}>
                <Text style={styles.linkBtnGoldText}>Use Defaults</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearAllOptions} style={styles.linkBtn}>
                <Text style={styles.linkBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.sectionHelp}>
            Leave everything empty and customers will see only Quantity.
          </Text>

          {/* Sizes — each has a label + price modifier (₱ added on top of base) */}
          <Text style={styles.subLabel}>Sizes</Text>
          {sizes.map((s, idx) => (
            <View key={`size-${idx}`} style={styles.row2col}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={s.label}
                onChangeText={(v) =>
                  setSizes((prev) => prev.map((x, i) => (i === idx ? { ...x, label: v } : x)))
                }
                placeholder="Small / Medium / Large"
                placeholderTextColor={COLORS.textSecondary}
              />
              <View style={[styles.input, styles.priceWrap]}>
                <Text style={styles.priceSign}>+₱</Text>
                <TextInput
                  style={styles.priceInput}
                  value={String(s.priceModifier)}
                  onChangeText={(v) => {
                    const num = parseFloat(v);
                    setSizes((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, priceModifier: Number.isNaN(num) ? 0 : num } : x,
                      ),
                    );
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <TouchableOpacity
                onPress={() => setSizes((prev) => prev.filter((_, i) => i !== idx))}
                style={styles.rmBtn}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addRowBtn}
            onPress={() => setSizes((p) => [...p, { label: '', priceModifier: 0 }])}
          >
            <Ionicons name="add" size={16} color={COLORS.primary} />
            <Text style={styles.addRowText}>Add size</Text>
          </TouchableOpacity>

          {/* Sugar levels — simple chip list */}
          <Text style={[styles.subLabel, { marginTop: 18 }]}>Sugar Levels</Text>
          <ChipEditor
            values={sugarLevels}
            onChange={setSugarLevels}
            placeholder="e.g. 50%"
          />

          {/* Temperatures — simple chip list */}
          <Text style={[styles.subLabel, { marginTop: 18 }]}>Temperatures</Text>
          <ChipEditor
            values={temperatures}
            onChange={setTemperatures}
            placeholder="e.g. Extra Cold"
          />

          {/* Add-ons */}
          <Text style={[styles.subLabel, { marginTop: 18 }]}>Add-ons</Text>
          {addOns.map((a, idx) => (
            <View key={`addon-${idx}`} style={styles.row2col}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={a.name}
                onChangeText={(v) =>
                  setAddOns((prev) => prev.map((x, i) => (i === idx ? { ...x, name: v } : x)))
                }
                placeholder="Coffee Jelly, Extra Shot, ..."
                placeholderTextColor={COLORS.textSecondary}
              />
              <View style={[styles.input, styles.priceWrap]}>
                <Text style={styles.priceSign}>+₱</Text>
                <TextInput
                  style={styles.priceInput}
                  value={String(a.price)}
                  onChangeText={(v) => {
                    const num = parseFloat(v);
                    setAddOns((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, price: Number.isNaN(num) ? 0 : num } : x,
                      ),
                    );
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <TouchableOpacity
                onPress={() => setAddOns((prev) => prev.filter((_, i) => i !== idx))}
                style={styles.rmBtn}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addRowBtn}
            onPress={() => setAddOns((p) => [...p, { name: '', price: 0 }])}
          >
            <Ionicons name="add" size={16} color={COLORS.primary} />
            <Text style={styles.addRowText}>Add add-on</Text>
          </TouchableOpacity>
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

function ChipEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <View>
      <View style={styles.chipRow}>
        {values.map((v) => (
          <TouchableOpacity
            key={v}
            style={styles.chip}
            onPress={() => onChange(values.filter((x) => x !== v))}
          >
            <Text style={styles.chipText}>{v}</Text>
            <Ionicons name="close" size={12} color={COLORS.white} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSecondary}
          onSubmitEditing={commit}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addChipBtn} onPress={commit}>
          <Ionicons name="add" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
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
  subLabel: { fontSize: SIZES.captionSize, color: COLORS.text, fontWeight: '600', marginBottom: 8 },
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
    marginBottom: 20,
  },
  toggleSub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  sectionHeader: { fontSize: SIZES.bodySize, fontWeight: '700', color: COLORS.text },
  sectionHelp: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginBottom: 14 },

  linkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  linkBtnText: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, fontWeight: '600' },
  linkBtnGold: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
  },
  linkBtnGoldText: { fontSize: SIZES.smallSize, color: COLORS.text, fontWeight: '700' },

  row2col: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  priceWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  priceSign: { color: COLORS.textSecondary, fontWeight: '600', marginRight: 4 },
  priceInput: { flex: 1, fontSize: SIZES.inputFontSize, color: COLORS.text, paddingVertical: 0 },
  rmBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  addRowText: { color: COLORS.primary, fontSize: SIZES.captionSize, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  chipText: { color: COLORS.white, fontWeight: '600', fontSize: SIZES.smallSize },
  addChipBtn: {
    width: SIZES.inputHeight,
    height: SIZES.inputHeight,
    borderRadius: SIZES.inputBorderRadius,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

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
