import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import LogoutButton from '../../components/LogoutButton';

export default function AdminProfileScreen() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Ionicons name="shield-checkmark" size={44} color={COLORS.primary} />
        </View>
        <Text style={styles.name}>{user?.fullName ?? 'Admin'}</Text>
        <Text style={styles.role}>CampusBrew Admin</Text>

        <LogoutButton style={{ marginTop: 32 }} />
      </View>
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
});
