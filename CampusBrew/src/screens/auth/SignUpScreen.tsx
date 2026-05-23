import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { AuthService } from '../../services/AuthService';

type Role = 'CUSTOMER' | 'DELIVERY_PERSONNEL' | 'SHOP_OPERATOR';

export default function SignUpScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const roles: { label: string; value: Role }[] = [
    { label: 'Customer', value: 'CUSTOMER' },
    { label: 'Delivery Personnel', value: 'DELIVERY_PERSONNEL' },
    { label: 'Shop Operator', value: 'SHOP_OPERATOR' },
  ];

  const handleSignUp = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await AuthService.register({ fullName, email, password, role });
      navigation.navigate('OTPVerification', { email });
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>☕</Text>
          </View>
          <Text style={styles.title}>Create your account</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>👤</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#999"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>✉</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="Password (min 8 characters)"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.inputIcon}>{showPassword ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          {/* Role Selector */}
          <Text style={styles.roleLabel}>Select Role</Text>
          <View style={styles.roleContainer}>
            {roles.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.roleButton, role === r.value && styles.roleButtonActive]}
                onPress={() => setRole(r.value)}
              >
                <Text style={[styles.roleText, role === r.value && styles.roleTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginLink}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#8B1A1A', justifyContent: 'center',
    alignItems: 'center', marginBottom: 12,
  },
  logoText: { fontSize: 32 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  form: { gap: 14 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, backgroundColor: '#fafafa',
  },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, height: 48, color: '#333', fontSize: 15 },
  roleLabel: { fontSize: 14, color: '#555', fontWeight: '500' },
  roleContainer: { flexDirection: 'row', gap: 8 },
  roleButton: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#ddd', alignItems: 'center',
  },
  roleButtonActive: { backgroundColor: '#8B1A1A', borderColor: '#8B1A1A' },
  roleText: { fontSize: 12, color: '#555' },
  roleTextActive: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#8B1A1A', borderRadius: 8,
    height: 48, justifyContent: 'center', alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loginText: { textAlign: 'center', color: '#666', fontSize: 14 },
  loginLink: { color: '#8B1A1A', fontWeight: '600' },
});