import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AuthService } from '../../services/AuthService';
import { COLORS, SIZES } from '../../constants/theme';

export default function OTPVerificationScreen({ route, navigation }: any) {
  const { email } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputs = useRef<TextInput[]>([]);

  const handleOtpChange = (value: string, index: number) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
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
      {/* Title */}
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.subtitle}>We sent a 6-digit code to your email</Text>

      {/* OTP Input Boxes */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              if (ref) inputs.current[index] = ref;
            }}
            style={[
              styles.otpInput,
              digit ? styles.otpInputFilled : null,
            ]}
            value={digit}
            onChangeText={(value) => handleOtpChange(value.slice(-1), index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            selectTextOnFocus
          />
        ))}
      </View>

      {/* Resend Link */}
      <TouchableOpacity onPress={handleResend} disabled={resending}>
        <Text style={styles.resendText}>
          {resending ? 'Sending...' : 'Resend code'}
        </Text>
      </TouchableOpacity>

      {/* Info Chip — gold background per wireframe (#FFD84D) */}
      <View style={styles.infoChip}>
        <Text style={styles.infoText}>
          Your account starts as{' '}
          <Text style={styles.infoTextBold}>Unverified</Text>
          {' '}— verify your CIT-U identity later to unlock Cash on Delivery
        </Text>
      </View>

      {/* Verify Button */}
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.buttonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.screenPadding,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Title
  title: {
    fontSize: SIZES.titleSize,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: SIZES.bodySize,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },

  // OTP inputs — white bg, #E8E8E8 border, filled state uses primary border
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  otpInput: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.inputBorderRadius,
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
  },

  // Resend
  resendText: {
    color: COLORS.primary,
    textAlign: 'center',
    fontSize: SIZES.captionSize,
    fontWeight: '600',
    marginBottom: 24,
  },

  // Info chip — wireframe uses #FFD84D gold bg
  infoChip: {
    width: '100%',
    backgroundColor: COLORS.goldLight,
    borderRadius: SIZES.inputBorderRadius,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: SIZES.captionSize,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoTextBold: {
    fontWeight: '600',
  },

  // Button
  button: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    height: SIZES.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: COLORS.border,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: SIZES.buttonFontSize,
    fontWeight: '600',
  },
});