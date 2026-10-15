import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * App-wide navigation ref so non-component code (e.g. a push-notification tap
 * handler) can navigate without a screen's `navigation` prop. Attached to the
 * NavigationContainer in App.tsx.
 */
export const navigationRef = createNavigationContainerRef();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    // @ts-expect-error — dynamic route name from a notification payload
    navigationRef.navigate(name, params);
  }
}
