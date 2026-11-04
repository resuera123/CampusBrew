import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SIZES } from '../../constants/theme';
import { showAlert } from '../../components/AppAlert';
import BrandLogo from '../../components/BrandLogo';

const DANGER = '#D93025';

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Empty fields are outlined in red with a short note instead of a pop-up.
  const [missing, setMissing] = useState({ email: false, password: false });

  const handleLogin = async () => {
    const next = { email: !email, password: !password };
    setMissing(next);
    if (next.email || next.password) return;
    setLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      const message: string = error.message ?? '';
      if (/suspended/i.test(message)) {
        showAlert('Account suspended', message, [
          { text: 'Close' },
          { text: 'Appeal', onPress: () => navigation.navigate('ContactSupport', { email, topic: 'APPEAL' }) },
        ]);
      } else {
        showAlert('Login Failed', message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <BrandLogo wordmark />
          <Text style={styles.tagline}>CIT-U Campus Beverage Delivery</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email Input */}
          <View style={[styles.inputContainer, missing.email && styles.inputError]}>
            <Ionicons name="mail-outline" size={20} color={missing.email ? DANGER : COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={(t) => {
                setEmail(t.replace(/\s/g, ''));
                if (missing.email) setMissing((m) => ({ ...m, email: false }));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          {missing.email && <Text style={styles.errorText}>Enter your email</Text>}

          {/* Password Input */}
          <View style={[styles.inputContainer, missing.password && styles.inputError]}>
            <Ionicons name="lock-closed-outline" size={20} color={missing.password ? DANGER : COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textSecondary}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (missing.password) setMissing((m) => ({ ...m, password: false }));
              }}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {missing.password && <Text style={styles.errorText}>Enter your password</Text>}

          {/* Log In Button — pill shape per wireframe */}
          <View style={{ paddingTop: 16 }}>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={{ paddingTop: 16 }}>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.signupText}>
                Don't have an account?{' '}
                <Text style={styles.signupLink}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Contact Support — open without an account, e.g. to appeal a suspension */}
          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => navigation.navigate('ContactSupport', { email })}
            activeOpacity={0.7}
          >
            <Ionicons name="help-buoy-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.supportText}>Need help? Contact Support</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.screenPadding,
    paddingVertical: 24,
  },

  // Logo section
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  tagline: {
    marginTop: 4,
    fontSize: SIZES.captionSize,
    color: COLORS.textSecondary,
  },

  // Form
  form: {
    gap: SIZES.formGap,
  },

  // Input fields — matches wireframe: white bg, #E8E8E8 border, 8px radius
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SIZES.inputHeight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.smallRadius,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: DANGER,
    borderWidth: 1.5,
    backgroundColor: '#FFF6F5',
  },
  errorText: {
    marginTop: -10,
    marginLeft: 4,
    fontSize: 12,
    color: DANGER,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: SIZES.inputHeight,
    fontSize: SIZES.inputFontSize,
    color: COLORS.text,
  },

  // Button — pill shape (borderRadius: 24) per wireframe
  button: {
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

  // Links
  forgotText: {
    color: COLORS.primary,
    textAlign: 'center',
    fontSize: SIZES.captionSize,
    fontWeight: '600',
  },
  signupText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: SIZES.captionSize,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  supportText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.captionSize,
    textDecorationLine: 'underline',
  },
  signupLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});