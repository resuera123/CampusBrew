import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { RatingService, RatingForm, RatingTarget, RateeRole } from '../../services/RatingService';

/**
 * v2.0 FR-3.6 — rate the other parties of a delivered order. The server decides who
 * the caller can rate (customer → shop + dasher, dasher → customer + shop,
 * shop → dasher) and supplies the tag choices. Ratings can be edited until the
 * window closes (24h after delivery); after that the screen is read-only.
 */

interface Draft {
  stars: number;
  tags: string[];
  review: string;
}

const ROLE_LABEL: Record<RateeRole, string> = {
  SHOP: 'Shop',
  DELIVERY_PERSONNEL: 'Dasher',
  CUSTOMER: 'Customer',
};

export default function RateOrderScreen({ route, navigation }: any) {
  const { token } = useAuth();
  const orderId: string = route?.params?.orderId;
  const [form, setForm] = useState<RatingForm | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const applyForm = (f: RatingForm) => {
    setForm(f);
    const next: Record<string, Draft> = {};
    f.targets.forEach((t) => {
      next[t.rateeRole] = { stars: t.stars ?? 0, tags: t.tags ?? [], review: t.review ?? '' };
    });
    setDrafts(next);
  };

  const load = useCallback(async () => {
    if (!token || !orderId) return;
    try {
      applyForm(await RatingService.form(orderId, token));
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load ratings');
    } finally {
      setLoading(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (role: RateeRole, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));

  const toggleTag = (role: RateeRole, tag: string) => {
    const current = drafts[role]?.tags ?? [];
    update(role, { tags: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag] });
  };

  const submit = async () => {
    if (!form || !token) return;
    const entries = form.targets
      .filter((t) => (drafts[t.rateeRole]?.stars ?? 0) > 0)
      .map((t) => {
        const d = drafts[t.rateeRole];
        return {
          rateeRole: t.rateeRole,
          stars: d.stars,
          tags: d.tags,
          review: t.allowReview && d.review.trim() ? d.review.trim() : undefined,
        };
      });
    if (entries.length === 0) {
      Alert.alert('Add a rating', 'Tap the stars to rate at least one party.');
      return;
    }
    setSubmitting(true);
    try {
      applyForm(await RatingService.submit(orderId, entries, token));
      Alert.alert('Thanks for rating!', 'You can edit your ratings until the window closes.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Could not submit', e.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const editable = !!form?.windowOpen;
  const alreadyRated = !!form?.targets.some((t) => t.stars);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Rate your order</Text>
        <View style={styles.topBarIcon} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : error || !form ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Something went wrong'}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryLink}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.orderLine}>Order #{orderId.slice(-6).toUpperCase()}</Text>

            {form.targets.map((t) => (
              <TargetCard
                key={t.rateeRole}
                target={t}
                draft={drafts[t.rateeRole]}
                editable={editable}
                onStars={(stars) => update(t.rateeRole, { stars })}
                onTag={(tag) => toggleTag(t.rateeRole, tag)}
                onReview={(review) => update(t.rateeRole, { review })}
              />
            ))}

            <Text style={styles.footNote}>
              {editable
                ? `You can edit your ratings until ${formatClose(form.closesAt)}.`
                : 'The rating window for this order has closed.'}
              {' '}Ratings show as an average after 3 ratings.
            </Text>
          </ScrollView>

          {editable && (
            <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.submitText}>{alreadyRated ? 'Update Ratings' : 'Submit Ratings'}</Text>
              )}
            </TouchableOpacity>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function TargetCard({
  target,
  draft,
  editable,
  onStars,
  onTag,
  onReview,
}: {
  target: RatingTarget;
  draft?: Draft;
  editable: boolean;
  onStars: (n: number) => void;
  onTag: (tag: string) => void;
  onReview: (text: string) => void;
}) {
  const stars = draft?.stars ?? 0;
  const tags = draft?.tags ?? [];
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {ROLE_LABEL[target.rateeRole]} · <Text style={styles.cardName}>{target.name}</Text>
      </Text>

      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} disabled={!editable} onPress={() => onStars(n)} hitSlop={6}>
            <Ionicons
              name={n <= stars ? 'star' : 'star-outline'}
              size={30}
              color={n <= stars ? COLORS.gold : COLORS.border}
            />
          </TouchableOpacity>
        ))}
      </View>

      {target.tagOptions?.length > 0 && (
        <View style={styles.tagsRow}>
          {target.tagOptions.map((tag) => {
            const on = tags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                disabled={!editable}
                style={[styles.tag, on && styles.tagOn]}
                onPress={() => onTag(tag)}
              >
                <Text style={[styles.tagText, on && styles.tagTextOn]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {target.allowReview && (
        <TextInput
          style={styles.review}
          value={draft?.review ?? ''}
          onChangeText={onReview}
          editable={editable}
          placeholder="Write a review (optional)"
          placeholderTextColor={COLORS.textSecondary}
          maxLength={300}
          multiline
        />
      )}
    </View>
  );
}

function formatClose(iso?: string | null): string {
  if (!iso) return 'the window closes';
  try {
    const d = new Date(iso);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'the window closes';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.screenPadding },
  topBar: {
    height: 56,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  topBarIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  errorText: { color: '#D93025', textAlign: 'center' },
  retryLink: { color: COLORS.primary, fontWeight: '600', marginTop: 8 },
  content: { padding: SIZES.screenPadding, paddingBottom: 24 },
  orderLine: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 12 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: SIZES.captionSize, color: COLORS.textSecondary },
  cardName: { color: COLORS.text, fontWeight: '700' },
  starsRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  tagOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tagText: { fontSize: SIZES.smallSize, color: COLORS.text },
  tagTextOn: { color: COLORS.white, fontWeight: '600' },
  review: {
    marginTop: 12,
    minHeight: 64,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: SIZES.captionSize,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
  footNote: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 },
  submitBtn: {
    height: SIZES.buttonHeight,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SIZES.screenPadding,
    marginBottom: 12,
  },
  submitText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
