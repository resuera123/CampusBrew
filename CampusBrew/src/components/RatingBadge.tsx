import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

/**
 * v2.0 FR-2.1 / FR-3.6 — "★ 4.6 (12)". The server sends a null average until the
 * ratee has enough ratings (rating.minCountToShow), which shows as "New" here —
 * with the count once there is one, so a fresh rating still visibly lands.
 */
export default function RatingBadge({
  average,
  count,
  size = 12,
}: {
  average?: number | null;
  count?: number;
  size?: number;
}) {
  const rated = average != null;
  return (
    <View style={styles.row}>
      <Ionicons name={rated ? 'star' : 'star-outline'} size={size} color={COLORS.gold} />
      <Text style={[styles.text, { fontSize: size }]}>
        {rated ? average!.toFixed(1) : 'New'}
        {count ? <Text style={styles.count}> ({count})</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { color: COLORS.text, fontWeight: '600' },
  count: { color: COLORS.textSecondary, fontWeight: '400' },
});
