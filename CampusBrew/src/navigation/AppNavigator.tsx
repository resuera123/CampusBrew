import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

// Account verification screens
import AccountVerificationScreen from '../screens/auth/AccountVerificationScreen';
import VerifiedSuccessScreen from '../screens/auth/VerifiedSuccessScreen';

// Customer screens
import HomeScreen from '../screens/customer/HomeScreen';
import ShopMenuScreen from '../screens/customer/ShopMenuScreen';
import CustomizeItemScreen from '../screens/customer/CustomizeItemScreen';
import CheckoutScreen from '../screens/customer/CheckoutScreen';
import OrderHistoryScreen from '../screens/customer/OrderHistoryScreen';
import OrderTrackingScreen from '../screens/customer/OrderTrackingScreen';
import NotificationScreen from '../screens/customer/NotificationScreen';
import ReorderCartScreen from '../screens/customer/ReorderCartScreen';
import OrdersPlaceholderScreen from '../screens/customer/OrdersPlaceholderScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import EditProfileScreen from '../screens/customer/EditProfileScreen';

// Delivery screens
import DeliveryDashboardScreen from '../screens/delivery/DeliveryDashboardScreen';
import ScheduleSettingsScreen from '../screens/delivery/ScheduleSettingsScreen';
import AssignedDeliveryScreen from '../screens/delivery/AssignedDeliveryScreen';
import DeliveryTabScreen from '../screens/delivery/DeliveryTabScreen';
import DeliveryHistoryScreen from '../screens/delivery/DeliveryHistoryScreen';

// Shop screens
import ShopDashboardScreen from '../screens/shop/ShopDashboardScreen';
import OrderQueueScreen from '../screens/shop/OrderQueueScreen';
import MenuManagementScreen from '../screens/shop/MenuManagementScreen';
import ItemAvailabilityScreen from '../screens/shop/ItemAvailabilityScreen';
import ShopProfileScreen from '../screens/shop/ShopProfileScreen';
import EditShopProfileScreen from '../screens/shop/EditShopProfileScreen';
import ShopOrderHistoryScreen from '../screens/shop/ShopOrderHistoryScreen';

// Bottom tab bar
import BottomTabBar from '../components/BottomTabBar';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Auth Stack ─────────────────────────────────────────────────

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

// ─── Customer Tabs ──────────────────────────────────────────────

function CustomerHomeTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="CustomerHome" component={HomeScreen} />
      <Tab.Screen name="Orders" component={OrderHistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function CustomerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomerTabs" component={CustomerHomeTabs} />
      <Stack.Screen name="ShopMenu" component={ShopMenuScreen} />
      <Stack.Screen name="CustomizeItem" component={CustomizeItemScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="ReorderCart" component={ReorderCartScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="AccountVerification" component={AccountVerificationScreen} />
      <Stack.Screen name="VerifiedSuccess" component={VerifiedSuccessScreen} />
    </Stack.Navigator>
  );
}

// ─── Delivery Tabs ──────────────────────────────────────────────

function DeliveryHomeTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="DeliveryDashboard" component={DeliveryDashboardScreen} />
      <Tab.Screen name="DeliveryOrders" component={DeliveryTabScreen} />
      <Tab.Screen name="DeliveryProfile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function DeliveryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DeliveryTabs" component={DeliveryHomeTabs} />
      <Stack.Screen name="ScheduleSettings" component={ScheduleSettingsScreen} />
      <Stack.Screen name="DeliveryHistory" component={DeliveryHistoryScreen} />
      <Stack.Screen name="AssignedDelivery" component={AssignedDeliveryScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="AccountVerification" component={AccountVerificationScreen} />
      <Stack.Screen name="VerifiedSuccess" component={VerifiedSuccessScreen} />
    </Stack.Navigator>
  );
}

// ─── Shop Tabs ──────────────────────────────────────────────────

function ShopHomeTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="ShopDashboard" component={ShopDashboardScreen} />
      <Tab.Screen name="ShopOrders" component={OrderQueueScreen} />
      <Tab.Screen name="ShopProfile" component={ShopProfileScreen} />
    </Tab.Navigator>
  );
}

export function ShopStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ShopTabs" component={ShopHomeTabs} />
      <Stack.Screen name="OrderQueue" component={OrderQueueScreen} />
      <Stack.Screen name="MenuManagement" component={MenuManagementScreen} />
      <Stack.Screen name="ItemAvailability" component={ItemAvailabilityScreen} />
      <Stack.Screen name="ShopOrderHistory" component={ShopOrderHistoryScreen} />
      <Stack.Screen name="EditShopProfile" component={EditShopProfileScreen} />
      <Stack.Screen name="AccountVerification" component={AccountVerificationScreen} />
      <Stack.Screen name="VerifiedSuccess" component={VerifiedSuccessScreen} />
    </Stack.Navigator>
  );
}
