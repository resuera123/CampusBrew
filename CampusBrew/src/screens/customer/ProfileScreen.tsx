import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const isVerified = user?.verificationStatus === 'VERIFIED';

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#94353E" />
          </View>
          <Text style={styles.name}>{user?.fullName || 'User'}</Text>
          <Text style={styles.phone}>+63 912 345 6789</Text>
        </View>

        {/* Verification Status */}
        <View style={styles.verificationSection}>
          <View style={styles.verificationRow}>
            <Text style={styles.verificationLabel}>Verification Status</Text>
            <View style={[styles.badge, isVerified ? styles.badgeGold : styles.badgeGray]}>
              <Text style={[styles.badgeText, isVerified ? styles.badgeTextGold : styles.badgeTextGray]}>
                {isVerified ? 'Verified' : 'Unverified'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('AccountVerification')}>
            <Text style={styles.verifyLink}>
              {isVerified ? 'Re-verify account →' : 'Verify account to unlock COD →'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Edit Profile Button — outlined per wireframe */}
        <TouchableOpacity
          style={styles.outlinedButton}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.7}
        >
          <Text style={styles.outlinedButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.outlinedButton, { marginTop: 16, borderColor: '#E8E8E8' }]}
          onPress={logout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#94353E" style={{ marginRight: 8 }} />
          <Text style={styles.outlinedButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { height: 56, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '600', color: '#000000' },
  content: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  name: { fontSize: 20, fontWeight: '600', color: '#000000', marginBottom: 4 },
  phone: { fontSize: 14, color: '#3A3A3A' },
  verificationSection: { marginBottom: 32 },
  verificationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  verificationLabel: { fontSize: 14, fontWeight: '500', color: '#3A3A3A' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeGold: { backgroundColor: '#F4C600' },
  badgeGray: { backgroundColor: '#E8E8E8' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextGold: { color: '#FFFFFF' },
  badgeTextGray: { color: '#3A3A3A' },
  verifyLink: { fontSize: 14, fontWeight: '600', color: '#94353E' },
  outlinedButton: { borderWidth: 2, borderColor: '#94353E', borderRadius: 24, height: 48, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  outlinedButtonText: { fontSize: 16, fontWeight: '600', color: '#94353E' },
});
