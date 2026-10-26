import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  BLOOD_GROUP_LABELS,
  COMPONENT_LABELS,
  STATUS_LABELS,
  URGENCY_LABELS,
  formatTimestamp,
} from '../../features/individual/patient-needs/present';
import {
  useCancelPatientNeed,
  usePatientNeed,
} from '../../features/individual/patient-needs/hooks';
import { appStyles } from '../styles';
import { PatientNeedConversationPanel } from '../../features/communication/patient-need-conversation-panel';

export default function PatientNeedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { record, loading, error, reload } = usePatientNeed(id);
  const {
    cancelling,
    cancelled,
    error: cancelError,
    cancel,
  } = useCancelPatientNeed();
  const [confirming, setConfirming] = useState(false);

  const displayed = cancelled ?? record;

  async function handleCancel() {
    if (!id) return;
    const updated = await cancel(id);
    setConfirming(false);
    if (updated) {
      await reload();
    }
  }

  return (
    <ScrollView style={appStyles.screen}>
      <Link style={appStyles.linkText} href="/patient-needs">
        ← Back to history
      </Link>
      <Text style={appStyles.title}>Patient need</Text>

      {loading ? <ActivityIndicator /> : null}

      {error ? (
        error.isUnauthorized ? (
          <View style={appStyles.errorBox}>
            <Text style={appStyles.errorText}>
              You need to sign in to view this request.
            </Text>
            <Link style={appStyles.linkText} href="/auth">
              Sign in
            </Link>
          </View>
        ) : error.status === 404 ? (
          <View style={appStyles.errorBox}>
            <Text style={appStyles.errorText}>
              This patient need does not exist or does not belong to your
              account.
            </Text>
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

      {displayed ? (
        <View style={appStyles.card}>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>
            {STATUS_LABELS[displayed.status]}
          </Text>
          <Text>Patient name: {displayed.patientName || 'Not provided'}</Text>
          <Text>Blood group: {BLOOD_GROUP_LABELS[displayed.bloodGroup]}</Text>
          <Text>Component: {COMPONENT_LABELS[displayed.component]}</Text>
          <Text>Units: {displayed.units}</Text>
          <Text>Urgency: {URGENCY_LABELS[displayed.urgency]}</Text>
          <Text>Required by: {formatTimestamp(displayed.requiredBy)}</Text>
          <Text>Submitted: {formatTimestamp(displayed.createdAt)}</Text>
          <Text style={{ marginTop: 6 }}>{displayed.additionalNotes}</Text>

          {cancelled ? (
            <View style={appStyles.successBox}>
              <Text style={appStyles.successText}>
                This patient need has been cancelled.
              </Text>
            </View>
          ) : null}

          {cancelError ? (
            <View style={appStyles.errorBox}>
              <Text style={appStyles.errorText}>
                {cancelError.status === 409
                  ? 'This request can no longer be cancelled. Refresh to see its current state.'
                  : cancelError.message}
              </Text>
              <Pressable onPress={() => void reload()}>
                <Text style={appStyles.linkText}>Refresh</Text>
              </Pressable>
            </View>
          ) : null}

          {!cancelled && record?.status === 'PENDING_HOSPITAL_REVIEW' ? (
            confirming ? (
              <View>
                <Text style={[appStyles.muted, { marginTop: 10 }]}>
                  Cancel this patient need?
                </Text>
                <Pressable
                  style={appStyles.dangerButton}
                  disabled={cancelling}
                  onPress={() => void handleCancel()}
                >
                  <Text style={appStyles.dangerButtonText}>
                    {cancelling ? 'Cancelling…' : 'Yes, cancel request'}
                  </Text>
                </Pressable>
                <Pressable
                  style={appStyles.secondaryButton}
                  disabled={cancelling}
                  onPress={() => setConfirming(false)}
                >
                  <Text style={appStyles.secondaryButtonText}>Keep it</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={appStyles.dangerButton}
                onPress={() => setConfirming(true)}
              >
                <Text style={appStyles.dangerButtonText}>
                  Cancel this patient need
                </Text>
              </Pressable>
            )
          ) : null}
        </View>
      ) : null}
      {record?.status === 'VERIFIED' && id ? (
        <PatientNeedConversationPanel patientNeedId={id} />
      ) : null}
    </ScrollView>
  );
}
