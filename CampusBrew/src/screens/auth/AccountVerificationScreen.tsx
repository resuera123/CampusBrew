import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { AuthService } from '../../services/AuthService';

export default function AccountVerificationScreen({ navigation }: any) {
  const { token, updateUser } = useAuth();
  const [citEmail, setCitEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [studentId, setStudentId] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!citEmail.endsWith('@cit.edu')) {
      Alert.alert('Error', 'Please enter a valid @cit.edu email');
      return;
    }
    setSendingOtp(true);
    try {
      await AuthService.sendVerificationOtp(citEmail, token!);
      Alert.alert('Sent', 'OTP sent to your CIT-U email');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async () => {
    if (!citEmail || !emailOtp || !studentId) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await AuthService.verifyAccount(citEmail, emailOtp, studentId, token!);
      // Update local user state immediately — no logout needed
      await updateUser({ verificationStatus: 'VERIFIED' });
      navigation.navigate('VerifiedSuccess');
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Verify Your Account</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.description}>
            Unlock Cash on Delivery by verifying your CIT-U student status
          </Text>

          <Text style={styles.label}>CIT-U Email</Text>
          <View style={styles.inputRow}>
            <View style={[styles.inputContainer, { flex: 1 }]}>
              <Ionicons name="mail-outline" size={20} color="#3A3A3A" style={{ marginRight: 12 }} />
              <TextInput style={styles.input} placeholder="you@cit.edu" placeholderTextColor="#3A3A3A" value={citEmail} onChangeText={setCitEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <TouchableOpacity style={[styles.sendOtpButton, sendingOtp && { opacity: 0.5 }]} onPress={handleSendOtp} disabled={sendingOtp}>
              {sendingOtp ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.sendOtpText}>Send</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Email OTP</Text>
          <View style={styles.inputContainer}>
            <TextInput style={styles.input} placeholder="Enter OTP" placeholderTextColor="#3A3A3A" value={emailOtp} onChangeText={setEmailOtp} keyboardType="number-pad" />
          </View>
          <Text style={styles.caption}>OTP sent to your CIT-U email</Text>

          <Text style={styles.label}>Student ID</Text>
          <View style={styles.inputContainer}>
            <TextInput style={styles.input} placeholder="23-XXXX-XXX" placeholderTextColor="#3A3A3A" value={studentId} onChangeText={setStudentId} />
          </View>
          <Text style={styles.caption}>Example: 23-1234-567</Text>

          <View style={{ paddingTop: 16 }}>
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Submit Verification</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { height: 56, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '600', color: '#000000' },
  content: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40 },
  description: { fontSize: 16, color: '#3A3A3A', marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '500', color: '#000000', marginBottom: 8, marginTop: 16 },
  caption: { fontSize: 12, fontWeight: '500', color: '#3A3A3A', marginTop: 4 },
  inputRow: { flexDirection: 'row', gap: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  input: { flex: 1, height: 48, fontSize: 16, color: '#000000' },
  sendOtpButton: { backgroundColor: '#94353E', borderRadius: 8, height: 48, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  sendOtpText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  button: { backgroundColor: '#94353E', borderRadius: 24, height: 48, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#E8E8E8' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});