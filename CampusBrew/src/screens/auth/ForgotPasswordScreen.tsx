import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../../services/AuthService';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    setLoading(true);
    try {
      await AuthService.forgotPassword(email);
      navigation.navigate('ResetPassword', { email });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Forgot Password</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.description}>
            Enter your email to receive a verification code
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#3A3A3A" style={{ marginRight: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#3A3A3A"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Send Code</Text>
            )}
          </TouchableOpacity>
        </View>
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
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 32 },
  description: { fontSize: 16, color: '#3A3A3A', marginBottom: 32 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 16, marginBottom: 24 },
  input: { flex: 1, height: 48, fontSize: 16, color: '#000000' },
  button: { backgroundColor: '#94353E', borderRadius: 24, height: 48, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#E8E8E8' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});