import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

export default function OrdersPlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="bag-outline" size={64} color={COLORS.border} />
      <Text style={styles.title}>My Orders</Text>
      <Text style={styles.subtitle}>Your order history will appear here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
});
