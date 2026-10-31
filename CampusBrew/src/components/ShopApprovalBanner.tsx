import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../constants/theme';
import { ShopApplicationService, ShopApprovalStatus } from '../services/ShopApplicationService';

/**
 * Shown on the dashboard of a shop that isn't approved yet: apply, under review,
 * or rejected with the admin's reason (apply again).
 */
export default function ShopApprovalBanner({ token, onApply }: { token: string | null; onApply: () => void }) {
  const [status, setStatus] = useState<ShopApprovalStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      ShopApplicationService.status(token).then(setStatus).catch(() => {});
    }, [token]),
  );

  if (!status || status.approved) return null;

  if (status.applicationStatus === 'PENDING') {
    return (
      <View style={[styles.card, styles.pending]}>
        <Ionicons name="time-outline" size={22} color="#8A6100" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Application under review</Text>
          <Text style={styles.body}>
            Customers will see your shop once an admin approves it. You can set up your menu meanwhile.
          </Text>
        </View>
      </View>
    );
  }

  const rejected = status.applicationStatus === 'REJECTED';
  return (
    <View style={[styles.card, rejected ? styles.rejected : styles.todo]}>
      <Ionicons
        name={rejected ? 'close-circle-outline' : 'storefront-outline'}
        size={22}
        color={rejected ? '#D93025' : COLORS.primary}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{rejected ? 'Application not approved' : "Your shop isn't live yet"}</Text>
        <Text style={styles.body}>
          {rejected
            ? `Reason: ${status.rejectionReason ?? '—'}`
            : 'Apply for approval so customers can find your shop and you can open it for orders.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={onApply}>
          <Text style={styles.buttonText}>{rejected ? 'Apply again' : 'Apply for approval'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 14, marginBottom: 12 },
  todo: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.primary },
  pending: { backgroundColor: '#FFF4D6' },
  rejected: { backgroundColor: '#FCE8E8' },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  body: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2, lineHeight: 18 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 10,
  },
  buttonText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.smallSize },
});
