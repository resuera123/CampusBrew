import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

// v2.0 FR-2.2 / NFR-U3 — confirmation sheet shown after "Add to Cart".
// Surfaces the line that was added, and tells the user when an identical item
// already in the cart just had its quantity bumped (rather than silently merging).
interface Props {
  visible: boolean;
  merged: boolean;
  itemName: string;
  optionsSummary: string;
  quantity: number;
  lineTotal: number;
  onViewCart: () => void;
  onContinue: () => void;
}

export default function AddToCartSheet({
  visible,
  merged,
  itemName,
  optionsSummary,
  quantity,
  lineTotal,
  onViewCart,
  onContinue,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onContinue}>
      <Pressable style={styles.backdrop} onPress={onContinue} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={20} color={COLORS.white} />
          </View>
          <Text style={styles.title}>Added to cart</Text>
        </View>

        {merged && (
          <Text style={styles.mergedNote}>
            Same item already in cart — quantity updated.
          </Text>
        )}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>
              {quantity} × {itemName}
            </Text>
            {!!optionsSummary && <Text style={styles.options}>{optionsSummary}</Text>}
          </View>
          <Text style={styles.lineTotal}>₱{lineTotal.toFixed(0)}</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={onViewCart} activeOpacity={0.85}>
          <Text style={styles.primaryText}>View Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onContinue} activeOpacity={0.7}>
          <Text style={styles.secondaryText}>Continue Browsing</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  check: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  mergedNote: { fontSize: 13, color: COLORS.primary, marginTop: 2, marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
    marginBottom: 16,
  },
  itemName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  options: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 2 },
  lineTotal: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginBottom: 10,
  },
  primaryText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
});
