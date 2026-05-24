import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function VerifiedSuccessScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      {/* Gold checkmark circle */}
      <View style={styles.iconCircle}>
        <Ionicons name="checkmark-circle" size={56} color="#FFFFFF" />
      </View>

      <Text style={styles.title}>Account Verified!</Text>
      <Text style={styles.subtitle}>
        Your CIT-U account has been successfully verified.
      </Text>

      {/* COD Unlocked Card — gold background per wireframe */}
      <View style={styles.codCard}>
        <View style={styles.codIconBox}>
          <Ionicons name="wallet-outline" size={24} color="#F4C600" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.codTitle}>Cash on Delivery Unlocked</Text>
          <Text style={styles.codSubtitle}>You can now choose COD at checkout</Text>
        </View>
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('CustomerTabs')}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Continue Shopping</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F4C600', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '600', color: '#000000', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#3A3A3A', textAlign: 'center', marginBottom: 32 },
  codCard: { width: '100%', backgroundColor: '#FFD84D', borderRadius: 12, padding: 24, flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 48 },
  codIconBox: { width: 48, height: 48, backgroundColor: '#FFFFFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  codTitle: { fontSize: 16, fontWeight: '600', color: '#000000', marginBottom: 4 },
  codSubtitle: { fontSize: 14, color: '#3A3A3A' },
  button: { width: '100%', backgroundColor: '#94353E', borderRadius: 24, height: 48, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
