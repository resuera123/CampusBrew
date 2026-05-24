import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export default function EditProfileScreen({ navigation }: any) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!fullName) {
      Alert.alert('Error', 'Full name is required');
      return;
    }
    setLoading(true);
    try {
      // TODO: call PUT /api/users/me when UserController is built
      Alert.alert('Success', 'Profile updated!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar with camera button */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color="#94353E" />
            </View>
            <TouchableOpacity style={styles.cameraButton}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Full Name */}
        <Text style={styles.label}>Full Name</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#3A3A3A" style={{ marginRight: 12 }} />
          <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#3A3A3A" value={fullName} onChangeText={setFullName} />
        </View>

        {/* Phone Number */}
        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={20} color="#3A3A3A" style={{ marginRight: 12 }} />
          <TextInput style={styles.input} placeholder="+63 912 345 6789" placeholderTextColor="#3A3A3A" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>

        {/* Email — read only */}
        <Text style={styles.label}>Email</Text>
        <View style={[styles.inputContainer, { backgroundColor: '#F5F5F5' }]}>
          <Ionicons name="mail-outline" size={20} color="#3A3A3A" style={{ marginRight: 12 }} />
          <TextInput style={[styles.input, { color: '#3A3A3A' }]} value={user?.fullName ? `${user.fullName.toLowerCase().replace(' ', '.')}@cit.edu` : ''} editable={false} />
          <Ionicons name="lock-closed" size={16} color="#3A3A3A" />
        </View>

        {/* Address */}
        <Text style={styles.label}>Address</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="location-outline" size={20} color="#3A3A3A" style={{ marginRight: 12 }} />
          <TextInput style={styles.input} placeholder="Main Building Room 203" placeholderTextColor="#3A3A3A" value={address} onChangeText={setAddress} />
        </View>

        {/* Date of Birth */}
        <Text style={styles.label}>Date of Birth</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="calendar-outline" size={20} color="#3A3A3A" style={{ marginRight: 12 }} />
          <TextInput style={styles.input} placeholder="05/15/2003" placeholderTextColor="#3A3A3A" value={dob} onChangeText={setDob} />
        </View>

        {/* Save Button */}
        <View style={{ paddingTop: 24 }}>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { height: 56, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '600', color: '#000000' },
  content: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  cameraButton: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: '#B85C65', justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '500', color: '#000000', marginBottom: 8, marginTop: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  input: { flex: 1, height: 48, fontSize: 16, color: '#000000' },
  button: { backgroundColor: '#94353E', borderRadius: 24, height: 48, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#E8E8E8' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
