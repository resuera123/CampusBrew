import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function AdminProfileScreen() {
  const { user, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Ionicons name="shield-checkmark" size={44} color={COLORS.primary} />
        </View>
        <Text style={styles.name}>{user?.fullName ?? 'Admin'}</Text>
        <Text style={styles.role}>CampusBrew Admin</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutOpen(true)}>
          <Ionicons name="log-out-outline" size={18} color="#D93025" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={logoutOpen}
        title="Log out?"
        message="You'll need to sign back in to review applications and reports."
        confirmLabel="Log out"
        destructive
        icon="log-out-outline"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          logout();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  content: { alignItems: 'center', padding: SIZES.screenPadding, paddingTop: 48 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  role: { fontSize: SIZES.captionSize, color: COLORS.textSecondary, marginTop: 4 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 32, padding: 10 },
  logoutText: { color: '#D93025', fontWeight: '600' },
});
