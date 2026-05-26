import React, { useCallback, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { DeliveryService } from '../../services/DeliveryService';
import AssignedDeliveryScreen from './AssignedDeliveryScreen';
import AvailableDeliveriesScreen from './AvailableDeliveriesScreen';

/**
 * Container for the "Delivery" bottom tab. Two states:
 *   - DP has a currentOrderId → render AssignedDeliveryScreen (their current job)
 *   - Otherwise → render AvailableDeliveriesScreen (marketplace list)
 *
 * Flips automatically after the DP claims an order (via onClaimed callback) and
 * after they complete one (re-poll on focus).
 */
export default function DeliveryTabScreen(props: any) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [hasActive, setHasActive] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const profile = await DeliveryService.getMyProfile(token);
      setHasActive(profile.currentOrderId != null);
    } catch {
      setHasActive(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Also flip the view when an assignment event arrives in the background.
  React.useEffect(() => {
    if (!socket) return;
    const onAssigned = () => setHasActive(true);
    socket.on('order:assigned', onAssigned);
    return () => { socket.off('order:assigned', onAssigned); };
  }, [socket]);

  if (hasActive === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (hasActive) {
    return <AssignedDeliveryScreen {...props} />;
  }
  return <AvailableDeliveriesScreen onClaimed={() => setHasActive(true)} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
  },
});
