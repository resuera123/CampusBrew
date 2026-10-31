import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { SocketProvider } from './src/context/SocketContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import {
  AdminStack,
  AuthStack,
  CustomerStack,
  DeliveryStack,
  ShopStack,
} from './src/navigation/AppNavigator';
import IncomingOrderModal from './src/screens/delivery/IncomingOrderModal';
import { AppAlertHost } from './src/components/AppAlert';
import { COLORS } from './src/constants/theme';
import { navigationRef } from './src/navigation/navigationRef';

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Not logged in → show auth screens
  if (!user) {
    return <AuthStack />;
  }

  // Logged in → route to role-specific dashboard
  // Per SDD 1.2: "Routes to role-specific dashboard"
  switch (user.role) {
    case 'DELIVERY_PERSONNEL':
      return <DeliveryStack />;
    case 'SHOP_OPERATOR':
      return <ShopStack />;
    case 'ADMIN':
      return <AdminStack />;
    case 'CUSTOMER':
    default:
      return <CustomerStack />;
  }
}

export default function App() {
  // GestureHandlerRootView must be the outermost component: the stack
  // navigator's gestures read the context it provides, and without it they
  // silently do nothing outside Expo Go.
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <AuthProvider>
          <SocketProvider>
            <NotificationsProvider>
              <CartProvider>
                <NavigationContainer ref={navigationRef}>
                  <RootNavigator />
                  <IncomingOrderModal />
                  <AppAlertHost />
                </NavigationContainer>
              </CartProvider>
            </NotificationsProvider>
          </SocketProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}