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
import CustomerDashboardScreen from '../screens/customer/CustomerDashboardScreen';
import OrdersPlaceholderScreen from '../screens/customer/OrdersPlaceholderScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import EditProfileScreen from '../screens/customer/EditProfileScreen';

// Delivery screens (placeholders)
import DeliveryDashboardPlaceholder from '../screens/delivery/DeliveryDashboardPlaceholder';

// Shop screens (placeholders)
import ShopDashboardPlaceholder from '../screens/shop/ShopDashboardPlaceholder';

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
      <Tab.Screen name="CustomerHome" component={CustomerDashboardScreen} />
      <Tab.Screen name="Orders" component={OrdersPlaceholderScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function CustomerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomerTabs" component={CustomerHomeTabs} />
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
      <Tab.Screen name="DeliveryDashboard" component={DeliveryDashboardPlaceholder} />
      <Tab.Screen name="DeliveryOrders" component={OrdersPlaceholderScreen} />
      <Tab.Screen name="DeliveryProfile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function DeliveryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DeliveryTabs" component={DeliveryHomeTabs} />
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
      <Tab.Screen name="ShopDashboard" component={ShopDashboardPlaceholder} />
      <Tab.Screen name="ShopOrders" component={OrdersPlaceholderScreen} />
      <Tab.Screen name="ShopProfile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function ShopStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ShopTabs" component={ShopHomeTabs} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="AccountVerification" component={AccountVerificationScreen} />
      <Stack.Screen name="VerifiedSuccess" component={VerifiedSuccessScreen} />
    </Stack.Navigator>
  );
}