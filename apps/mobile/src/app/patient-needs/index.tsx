import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScreen } from '../../components/keyboard-aware-screen';
import {
  BLOOD_GROUP_LABELS,
  COMPONENT_LABELS,
  STATUS_LABELS,
  formatTimestamp,
} from '../../features/individual/patient-needs/present';
import { usePatientNeedHistory } from '../../features/individual/patient-needs/hooks';
import { appStyles } from '../styles';

const PAGE_SIZE = 10;

export default function PatientNeedsHistoryScreen() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = usePatientNeedHistory(
    page,
    PAGE_SIZE,
  );

  return (
    <KeyboardAwareScreen>
      <View style={appStyles.row}>
        <Text style={appStyles.title}>My patient needs</Text>
        <Link style={appStyles.linkText} href="/patient-needs/new">
          + New
        </Link>
      </View>

      {error ? (
        error.isUnauthorized ? (
          <View style={appStyles.errorBox}>
            <Text style={appStyles.errorText}>
              You need to sign in to see your history.
            </Text>
            <Link style={appStyles.linkText} href="/auth">
              Sign in
            </Link>
          </View>
        ) : (
          <View style={appStyles.errorBox}>
            <Text style={appStyles.errorText}>{error.message}</Text>
            <Pressable onPress={() => void reload()}>
              <Text style={appStyles.linkText}>Retry</Text>
            </Pressable>
          </View>
        )
      ) : null}

      {loading ? <ActivityIndicator /> : null}

      {!loading && data && data.data.length === 0 ? (
        <View style={appStyles.card}>
          <Text>No patient needs yet.</Text>
          <Link style={appStyles.linkText} href="/hospitals">
            Find a hospital and submit one
          </Link>
        </View>
      ) : null}

      {data &&
        data.data.map((record) => (
          <View key={record.id} style={appStyles.card}>
            <View style={appStyles.row}>
              <Text style={{ fontWeight: '700' }}>
                {BLOOD_GROUP_LABELS[record.bloodGroup]} ·{' '}
                {COMPONENT_LABELS[record.component]} · {record.units} unit
                {record.units === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={appStyles.muted}>
              {STATUS_LABELS[record.status]} · submitted{' '}
              {formatTimestamp(record.createdAt)}
            </Text>
            <Link
              style={appStyles.linkText}
              href={`/patient-needs/${record.id}`}
            >
              View
            </Link>
          </View>
        ))}

      {data && data.meta.totalPages > 1 ? (
        <View style={appStyles.row}>
          <Pressable
            style={appStyles.secondaryButton}
            disabled={page <= 1 || loading}
            onPress={() => setPage(page - 1)}
          >
            <Text style={appStyles.secondaryButtonText}>Previous</Text>
          </Pressable>
          <Text style={appStyles.muted}>
            Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total}{' '}
            total
          </Text>
          <Pressable
            style={appStyles.secondaryButton}
            disabled={page >= data.meta.totalPages || loading}
            onPress={() => setPage(page + 1)}
          >
            <Text style={appStyles.secondaryButtonText}>Next</Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAwareScreen>
  );
}
