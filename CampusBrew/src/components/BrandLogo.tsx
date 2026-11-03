import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const BADGE = require('../../assets/logo-badge.png');

/**
 * The CampusBrew app-icon badge, optionally with the "CampusBrew" wordmark
 * ("Campus" regular, "Brew" bold, as in the brand sheet).
 */
export default function BrandLogo({ size = 88, wordmark = false }: { size?: number; wordmark?: boolean }) {
  return (
    <View style={styles.wrap}>
      <Image
        source={BADGE}
        style={[styles.badge, { width: size, height: size, borderRadius: size * 0.225 }]}
        accessibilityLabel="CampusBrew"
      />
      {wordmark && (
        <Text style={styles.wordmark}>
          Campus<Text style={styles.bold}>Brew</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  badge: {
    shadowColor: COLORS.espresso,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  wordmark: { marginTop: 14, fontSize: 30, color: COLORS.primary, letterSpacing: -0.5 },
  bold: { fontWeight: '700' },
});
