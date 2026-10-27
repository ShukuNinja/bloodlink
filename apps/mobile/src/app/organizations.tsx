import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatDistanceMeters } from '@bloodlink/ui';
import { KeyboardAwareScreen } from '../components/keyboard-aware-screen';
import type {
  AuthUser,
  OrganizationSummary,
  OrganizationType,
} from '@bloodlink/contracts';
import { fetchCurrentUser } from '../api/auth';
import { ApiClientError } from '../api/client';
import { organizationsApi } from '../features/organizations/api';
import { appStyles } from './styles';

export default function OrganizationsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<OrganizationType | ''>('');
  const [results, setResults] = useState<OrganizationSummary[] | null>(null);
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCurrentUser()
      .then(setUser)
      .catch(() => undefined);
    void organizationsApi
      .listSubscriptions()
      .then((response) => {
        setSubscribedIds(
          new Set(
            response.data
              .filter((item) => item.status === 'ACTIVE')
              .map((item) => item.organizationId),
          ),
        );
      })
      .catch(() => undefined);
  }, []);

  async function search() {
    if (!query.trim()) {
      setError('Enter an organization name to search.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await organizationsApi.search({
        query: query.trim(),
        ...(type ? { type } : {}),
      });
      setResults(response.data);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not search organizations.',
      );
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSubscription(organization: OrganizationSummary) {
    setBusyId(organization.id);
    setError(null);
    try {
      if (subscribedIds.has(organization.id)) {
        await organizationsApi.unsubscribe(organization.id);
        setSubscribedIds((current) => {
          const next = new Set(current);
          next.delete(organization.id);
          return next;
        });
      } else {
        await organizationsApi.subscribe(organization.id);
        setSubscribedIds((current) => new Set(current).add(organization.id));
      }
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not update this subscription.',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function startConversation(target: OrganizationSummary) {
    const source = user?.organizations.find(
      (item) => item.type !== target.type,
    );
    if (!source) return;
    setBusyId(target.id);
    setError(null);
    try {
      const response = await organizationsApi.openConversation(
        target.id,
        source.id,
      );
      router.push({
        pathname: '/conversations',
        params: { conversationId: response.data.id },
      });
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not open this conversation.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <KeyboardAwareScreen>
      <Text style={appStyles.title}>Find hospitals and blood banks</Text>
      <Text style={appStyles.subtitle}>
        Search active organizations, subscribe for request updates, and start
        organization conversations.
      </Text>
      <View style={appStyles.card}>
        <Text style={appStyles.label}>Organization name</Text>
        <TextInput
          style={appStyles.input}
          accessibilityLabel="Organization name"
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name"
          maxLength={255}
        />
        <Text style={appStyles.label}>Type</Text>
        <View style={appStyles.row}>
          {(['', 'HOSPITAL', 'BLOOD_CENTRE'] as const).map((value) => (
            <Pressable
              key={value || 'all'}
              style={[
                appStyles.optionChip,
                type === value && appStyles.optionChipSelected,
              ]}
              onPress={() => setType(value)}
            >
              <Text style={appStyles.optionChipText}>
                {value === ''
                  ? 'All'
                  : value === 'HOSPITAL'
                    ? 'Hospitals'
                    : 'Blood banks'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={appStyles.primaryButton}
          disabled={loading}
          onPress={() => void search()}
        >
          <Text style={appStyles.buttonText}>
            {loading ? 'Searching…' : 'Search'}
          </Text>
        </Pressable>
        <Link href="/subscriptions" style={appStyles.linkText}>
          View subscribed organizations
        </Link>
      </View>
      {error ? (
        <View style={appStyles.errorBox}>
          <Text style={appStyles.errorText}>{error}</Text>
        </View>
      ) : null}
      {loading ? <ActivityIndicator /> : null}
      {results?.map((organization) => {
        const canChat =
          user?.organizations.some((item) => item.type !== organization.type) ??
          false;
        return (
          <View style={appStyles.card} key={organization.id}>
            <Text style={{ fontWeight: '700' }}>{organization.name}</Text>
            {organization.distanceMeters !== undefined ? (
              <Text style={appStyles.muted}>
                {formatDistanceMeters(organization.distanceMeters)} away
              </Text>
            ) : null}
            <Text style={appStyles.muted}>
              {organization.type === 'HOSPITAL' ? 'Hospital' : 'Blood bank'}
            </Text>
            <Pressable
              style={appStyles.secondaryButton}
              disabled={busyId === organization.id}
              onPress={() => void toggleSubscription(organization)}
            >
              <Text style={appStyles.secondaryButtonText}>
                {busyId === organization.id
                  ? 'Saving…'
                  : subscribedIds.has(organization.id)
                    ? 'Unsubscribe'
                    : 'Subscribe'}
              </Text>
            </Pressable>
            {canChat ? (
              <Pressable
                style={appStyles.primaryButton}
                disabled={busyId === organization.id}
                onPress={() => void startConversation(organization)}
              >
                <Text style={appStyles.buttonText}>Message</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <Link style={appStyles.linkText} href="/conversations">
        Open conversations
      </Link>
    </KeyboardAwareScreen>
  );
}
