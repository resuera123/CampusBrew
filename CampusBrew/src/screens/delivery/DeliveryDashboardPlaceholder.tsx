import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

export default function DeliveryDashboardPlaceholder() {
  return (
    <View style={styles.container}>
      <Ionicons name="bicycle-outline" size={64} color={COLORS.primary} />
      <Text style={styles.title}>Delivery Dashboard</Text>
      <Text style={styles.subtitle}>Coming soon — Module 3</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
});
