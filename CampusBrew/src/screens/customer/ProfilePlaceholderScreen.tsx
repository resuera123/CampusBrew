import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

export default function ProfilePlaceholderScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={48} color={COLORS.primary} />
      </View>
      <Text style={styles.name}>{user?.fullName || 'User'}</Text>
      <Text style={styles.status}>
        {user?.verificationStatus === 'VERIFIED' ? 'Verified' : 'Unverified'}
      </Text>

      <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.primary} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.backgroundSecondary, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  name: { fontSize: 20, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  status: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 32 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: COLORS.primary, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12 },
  logoutText: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
});
