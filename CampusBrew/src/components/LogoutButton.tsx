import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from './ConfirmDialog';
import { COLORS, SIZES } from '../constants/theme';

/**
 * The one Log Out button every profile uses (customer, dasher, shop, admin):
 * an outlined pill with the maroon icon, and the same "Log out?" confirmation.
 */
export default function LogoutButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity style={[styles.button, style]} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
        <Text style={styles.text}>Log Out</Text>
      </TouchableOpacity>
      <ConfirmDialog
        visible={open}
        title="Log out?"
        message="You'll be signed out and returned to the login screen."
        confirmLabel="Log out"
        destructive
        icon="log-out-outline"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          logout();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    marginTop: 16,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.buttonBorderRadius,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
});
