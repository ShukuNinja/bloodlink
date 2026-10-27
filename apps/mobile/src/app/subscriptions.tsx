import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScreen } from '../components/keyboard-aware-screen';
import type { OrganizationSubscription } from '@bloodlink/contracts';
import { ApiClientError } from '../api/client';
import { organizationsApi } from '../features/organizations/api';
import { appStyles } from './styles';

export default function SubscriptionsScreen() {
  const [items, setItems] = useState<OrganizationSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await organizationsApi.listSubscriptions();
      setItems(response.data);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not load subscriptions.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function unsubscribe(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await organizationsApi.unsubscribe(id);
      setItems((current) =>
        current.filter((item) => item.organizationId !== id),
      );
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not remove subscription.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <KeyboardAwareScreen>
      <Text style={appStyles.title}>Subscribed organizations</Text>
      <Text style={appStyles.subtitle}>
        Hospitals and blood banks you follow.
      </Text>
      <Link href="/organizations" style={appStyles.linkText}>
        Find organizations
      </Link>
      {error ? (
        <View style={appStyles.errorBox}>
          <Text style={appStyles.errorText}>{error}</Text>
        </View>
      ) : null}
      {loading ? <ActivityIndicator /> : null}
      {!loading && !items.length ? (
        <View style={appStyles.card}>
          <Text>No subscriptions yet.</Text>
        </View>
      ) : null}
      {items.map((item) => (
        <View key={item.id} style={appStyles.card}>
          <Text style={{ fontWeight: '700' }}>{item.organizationName}</Text>
          <Text style={appStyles.muted}>
            {item.organizationType === 'HOSPITAL' ? 'Hospital' : 'Blood bank'}
          </Text>
          <Pressable
            style={appStyles.secondaryButton}
            disabled={busyId === item.organizationId}
            onPress={() => void unsubscribe(item.organizationId)}
          >
            <Text style={appStyles.secondaryButtonText}>
              {busyId === item.organizationId ? 'Removing…' : 'Unsubscribe'}
            </Text>
          </Pressable>
        </View>
      ))}
      <Link href="/conversations" style={appStyles.linkText}>
        Conversations
      </Link>
    </KeyboardAwareScreen>
  );
}
