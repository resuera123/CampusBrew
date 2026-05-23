import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { AuthService } from '../../services/AuthService';

export default function OTPVerificationScreen({ route, navigation }: any) {
  const { email } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputs = useRef<TextInput[]>([]);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code');
      return;
    }
    setLoading(true);
    try {
      await AuthService.verifyOtp(email, otpString);
      Alert.alert('Success', 'Email verified! You can now log in.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await AuthService.resendOtp(email);
      Alert.alert('Sent', 'A new OTP has been sent to your email');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.subtitle}>We sent a 6-digit code to</Text>
      <Text style={styles.email}>{email}</Text>

      {/* OTP Input Boxes */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => { if (ref) inputs.current[index] = ref; }}
            style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
            value={digit}
            onChangeText={(value) => handleOtpChange(value.slice(-1), index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
          />
        ))}
      </View>

      <TouchableOpacity onPress={handleResend} disabled={resending}>
        <Text style={styles.resendText}>
          {resending ? 'Sending...' : 'Resend code'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.infoText}>
        Your account starts as Unverified — verify your CIT-U identity later to unlock Cash on Delivery
      </Text>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  email: { fontSize: 14, color: '#8B1A1A', fontWeight: '600', textAlign: 'center', marginBottom: 32 },
  otpContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 },
  otpInput: {
    width: 48, height: 56, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 8, fontSize: 24, fontWeight: 'bold', color: '#333',
    backgroundColor: '#fafafa',
  },
  otpInputFilled: { borderColor: '#8B1A1A', backgroundColor: '#fff' },
  resendText: { color: '#8B1A1A', textAlign: 'center', fontSize: 14, marginBottom: 24 },
  infoText: {
    fontSize: 12, color: '#666', textAlign: 'center',
    backgroundColor: '#fff8e1', padding: 12, borderRadius: 8, marginBottom: 24,
  },
  button: {
    backgroundColor: '#8B1A1A', borderRadius: 8,
    height: 48, justifyContent: 'center', alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});