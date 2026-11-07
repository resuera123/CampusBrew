import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

/**
 * Skeleton loaders: grey placeholder shapes in the layout of the content that's
 * loading, pulsing gently. Blocks inside one <Skeleton> pulse together.
 */

const BLOCK = '#ECE4DD';
const Pulse = createContext<Animated.Value | null>(null);

export function Skeleton({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    // No pulsing for people who turned on Reduce Motion; the shapes still show.
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled || reduce) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          ]),
        );
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);

  return (
    <Pulse.Provider value={opacity}>
      <View style={style} accessible accessibilityLabel="Loading" accessibilityRole="progressbar">
        {children}
      </View>
    </Pulse.Provider>
  );
}

export function Bone({
  width = '100%',
  height = 14,
  radius = 6,
  style,
}: {
  width?: ViewStyle['width'];
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useContext(Pulse);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: BLOCK }, opacity ? { opacity } : null, style]}
    />
  );
}

// ─── Layouts for the busiest screens ────────────────────────────

/** Customer Home: partner shop cards, then the popular drinks row. */
export function HomeSkeleton() {
  return (
    <Skeleton>
      <Bone width={130} height={18} style={{ marginBottom: 12 }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.card}>
          <Bone width={64} height={64} radius={12} />
          <View style={styles.lines}>
            <Bone width="70%" height={16} />
            <Bone width="45%" height={12} />
            <Bone width="30%" height={12} />
          </View>
        </View>
      ))}
      <Bone width={150} height={18} style={{ marginTop: 12, marginBottom: 12 }} />
      <View style={styles.row}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.tile}>
            <Bone height={90} radius={12} />
            <Bone width="80%" height={12} style={{ marginTop: 8 }} />
            <Bone width="40%" height={12} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
    </Skeleton>
  );
}

/** Shop menu: category chips, then item rows with a photo. */
export function MenuSkeleton() {
  return (
    <Skeleton style={styles.pad}>
      <Bone height={44} radius={22} style={{ marginBottom: 14 }} />
      <View style={[styles.row, { marginBottom: 16 }]}>
        {[64, 84, 72, 60].map((w, i) => <Bone key={i} width={w} height={30} radius={15} />)}
      </View>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.card}>
          <Bone width={72} height={72} radius={12} />
          <View style={styles.lines}>
            <Bone width="65%" height={16} />
            <Bone width="90%" height={12} />
            <Bone width="25%" height={14} />
          </View>
        </View>
      ))}
    </Skeleton>
  );
}

/** A list of order cards (customer Order History, shop Order Queue). */
export function OrderListSkeleton({ count = 4, withTabs = false }: { count?: number; withTabs?: boolean }) {
  return (
    <Skeleton style={styles.pad}>
      {withTabs && (
        <View style={[styles.row, { marginBottom: 16 }]}>
          {[80, 90, 70].map((w, i) => <Bone key={i} width={w} height={32} radius={16} />)}
        </View>
      )}
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.card, styles.column]}>
          <View style={styles.spread}>
            <Bone width="40%" height={16} />
            <Bone width={70} height={22} radius={11} />
          </View>
          <Bone width="75%" height={12} style={{ marginTop: 10 }} />
          <Bone width="50%" height={12} style={{ marginTop: 6 }} />
          <View style={[styles.spread, { marginTop: 12 }]}>
            <Bone width="30%" height={14} />
            <Bone width={90} height={32} radius={16} />
          </View>
        </View>
      ))}
    </Skeleton>
  );
}

/** Shop dashboard: greeting, sales card, chart, then the Manage rows. */
export function ShopDashboardSkeleton() {
  return (
    <Skeleton style={styles.pad}>
      <Bone width={100} height={12} />
      <Bone width="60%" height={24} style={{ marginTop: 8 }} />
      <Bone width={70} height={24} radius={12} style={{ marginTop: 10, marginBottom: 20 }} />
      <View style={styles.card}>
        <Bone width={44} height={44} radius={22} />
        <View style={styles.lines}>
          <Bone width="35%" height={12} />
          <Bone width="50%" height={24} />
          <Bone width="60%" height={12} />
        </View>
      </View>
      <View style={[styles.card, styles.column]}>
        <Bone width="40%" height={16} />
        <Bone height={140} radius={10} style={{ marginTop: 12 }} />
      </View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.card}>
          <Bone width={36} height={36} radius={18} />
          <View style={styles.lines}>
            <Bone width="45%" height={14} />
            <Bone width="65%" height={12} />
          </View>
        </View>
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  pad: { padding: SIZES.screenPadding },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.cardRadius,
    padding: 14,
    marginBottom: 12,
  },
  column: { flexDirection: 'column', alignItems: 'stretch', gap: 0 },
  lines: { flex: 1, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tile: { flex: 1 },
});
