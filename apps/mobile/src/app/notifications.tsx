import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScreen } from '../components/keyboard-aware-screen';
import type { InAppNotification } from '@bloodlink/contracts';
import { ApiClientError } from '../api/client';
import { listNotifications } from '../features/notifications/api';
import { appStyles } from './styles';

export default function NotificationsScreen() {
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listNotifications();
      setItems(response.data);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not load request alerts.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <KeyboardAwareScreen>
      <Text style={appStyles.title}>Request alerts</Text>
      <Text style={appStyles.subtitle}>
        Alerts reflect current open requests and your organization
        subscriptions.
      </Text>
      {loading ? <ActivityIndicator /> : null}
      {error ? (
        <View style={appStyles.errorBox}>
          <Text style={appStyles.errorText}>{error}</Text>
          <Pressable
            style={appStyles.secondaryButton}
            onPress={() => void load()}
          >
            <Text style={appStyles.secondaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <View style={appStyles.card}>
          <Text style={appStyles.subtitle}>No current request alerts.</Text>
          <Link href="/organizations" style={appStyles.linkText}>
            Find organizations to subscribe to
          </Link>
        </View>
      ) : null}
      {items.map((item) => (
        <View style={appStyles.card} key={item.bloodRequestId}>
          <Text style={{ fontWeight: '700' }}>{item.title}</Text>
          <Text>{item.body}</Text>
          <Text style={appStyles.muted}>
            {item.hospitalName} · {item.urgency.replaceAll('_', ' ')} ·{' '}
            {item.requestStatus.replaceAll('_', ' ')}
          </Text>
          <Text style={appStyles.muted}>
            {item.unitsRequired} units · required by{' '}
            {new Date(item.requiredBy).toLocaleString()}
          </Text>
          <Text style={appStyles.muted}>
            Donor and blood bank response actions are available in the web
            client.
          </Text>
        </View>
      ))}
    </KeyboardAwareScreen>
  );
}
