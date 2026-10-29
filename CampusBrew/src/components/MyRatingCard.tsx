import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';

/**
 * v2.0 FR-3.6 — the shop's or dasher's own rating on their profile. The server
 * sends a null average until there are enough ratings (rating.minCountToShow).
 */
export default function MyRatingCard({
  average,
  count = 0,
}: {
  average?: number | null;
  count?: number;
}) {
  const rated = average != null;
  const filled = rated ? Math.round(average!) : 0;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Your rating</Text>
      <View style={styles.row}>
        <Text style={styles.value}>{rated ? average!.toFixed(1) : '—'}</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Ionicons key={i} name={i <= filled ? 'star' : 'star-outline'} size={18} color={COLORS.gold} />
          ))}
        </View>
      </View>
      <Text style={styles.caption}>
        {rated
          ? `From ${count} rating${count === 1 ? '' : 's'}`
          : count > 0
            ? `${count} rating${count === 1 ? '' : 's'} so far — your average shows after a few more.`
            : 'No ratings yet.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  value: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  stars: { flexDirection: 'row', gap: 2 },
  caption: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4 },
});
