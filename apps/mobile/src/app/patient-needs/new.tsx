import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type {
  PatientNeedBloodGroup,
  PatientNeedComponent,
  PatientNeedUrgency,
} from '@bloodlink/contracts';
import { validationIssues } from '../../api/client';
import {
  BLOOD_GROUPS,
  BLOOD_GROUP_LABELS,
  COMPONENTS,
  COMPONENT_LABELS,
  URGENCIES,
  URGENCY_LABELS,
} from '../../features/individual/patient-needs/present';
import { useCreatePatientNeed } from '../../features/individual/patient-needs/hooks';
import { appStyles } from '../styles';

export default function NewPatientNeedScreen() {
  const params = useLocalSearchParams<{
    hospitalId?: string;
    hospitalName?: string;
  }>();
  const hospitalId = params.hospitalId ?? '';
  const hospitalName = params.hospitalName ?? '';

  const [bloodGroup, setBloodGroup] =
    useState<PatientNeedBloodGroup>('O_POSITIVE');
  const [component, setComponent] =
    useState<PatientNeedComponent>('WHOLE_BLOOD');
  const [units, setUnits] = useState('1');
  const [urgency, setUrgency] = useState<PatientNeedUrgency>('ROUTINE');
  const [requiredBy, setRequiredBy] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const { submitting, created, error, create } = useCreatePatientNeed();

  async function handleSubmit() {
    setFormError(null);
    if (!hospitalId) {
      setFormError('Select a hospital first.');
      return;
    }
    const requiredByDate = new Date(requiredBy);
    if (!requiredBy || Number.isNaN(requiredByDate.getTime())) {
      setFormError(
        'Required-by must be a date and time, e.g. 2026-10-12T14:30.',
      );
      return;
    }
    const unitsNumber = Number(units);
    if (!Number.isInteger(unitsNumber) || unitsNumber <= 0) {
      setFormError('Units must be a positive whole number.');
      return;
    }

    await create({
      hospitalId,
      bloodGroup,
      component,
      units: unitsNumber,
      urgency,
      requiredBy: requiredByDate.toISOString(),
      additionalNotes,
    });
  }

  if (created) {
    return (
      <ScrollView style={appStyles.screen}>
        <Text style={appStyles.title}>Patient need submitted</Text>
        <View style={appStyles.successBox}>
          <Text style={appStyles.successText}>
            Your request was submitted and is now pending hospital review.
          </Text>
        </View>
        <Link style={appStyles.linkText} href={`/patient-needs/${created.id}`}>
          View request
        </Link>
        <Link style={appStyles.linkText} href="/patient-needs">
          Go to history
        </Link>
      </ScrollView>
    );
  }

  const issues = validationIssues(error);

  return (
    <ScrollView style={appStyles.screen}>
      <Text style={appStyles.title}>Submit a patient need</Text>

      {hospitalId ? (
        <Text style={appStyles.subtitle}>
          Hospital: {hospitalName || hospitalId}{' '}
        </Text>
      ) : (
        <Text style={appStyles.subtitle}>
          No hospital selected.{' '}
          <Link style={appStyles.linkText} href="/hospitals">
            Find a nearby hospital
          </Link>
        </Text>
      )}

      {formError ? (
        <View style={appStyles.errorBox}>
          <Text style={appStyles.errorText}>{formError}</Text>
        </View>
      ) : null}

      {error ? (
        error.isUnauthorized ? (
          <View style={appStyles.errorBox}>
            <Text style={appStyles.errorText}>
              You need to sign in to submit a patient need.
            </Text>
            <Link style={appStyles.linkText} href="/auth">
              Sign in
            </Link>
          </View>
        ) : (
          <View style={appStyles.errorBox}>
            <Text style={appStyles.errorText}>{error.message}</Text>
            {issues.map((issue) => (
              <Text
                key={`${issue.path}-${issue.code}`}
                style={appStyles.errorText}
              >
                {issue.path || 'request'}: {issue.code}
              </Text>
            ))}
          </View>
        )
      ) : null}

      <View style={appStyles.card}>
        <Text style={appStyles.label}>Blood group</Text>
        <View style={appStyles.row}>
          {BLOOD_GROUPS.map((value) => (
            <Pressable
              key={value}
              style={[
                appStyles.optionChip,
                bloodGroup === value ? appStyles.optionChipSelected : null,
              ]}
              onPress={() => setBloodGroup(value)}
            >
              <Text style={appStyles.optionChipText}>
                {BLOOD_GROUP_LABELS[value]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={appStyles.label}>Component</Text>
        <View style={appStyles.row}>
          {COMPONENTS.map((value) => (
            <Pressable
              key={value}
              style={[
                appStyles.optionChip,
                component === value ? appStyles.optionChipSelected : null,
              ]}
              onPress={() => setComponent(value)}
            >
              <Text style={appStyles.optionChipText}>
                {COMPONENT_LABELS[value]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={appStyles.label}>Urgency</Text>
        <View style={appStyles.row}>
          {URGENCIES.map((value) => (
            <Pressable
              key={value}
              style={[
                appStyles.optionChip,
                urgency === value ? appStyles.optionChipSelected : null,
              ]}
              onPress={() => setUrgency(value)}
            >
              <Text style={appStyles.optionChipText}>
                {URGENCY_LABELS[value]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={appStyles.label}>Units</Text>
        <TextInput
          style={appStyles.input}
          value={units}
          onChangeText={setUnits}
          keyboardType="numeric"
        />

        <Text style={appStyles.label}>Required by (e.g. 2026-10-12T14:30)</Text>
        <TextInput
          style={appStyles.input}
          value={requiredBy}
          onChangeText={setRequiredBy}
          autoCapitalize="none"
          placeholder="2026-10-12T14:30"
        />

        <Text style={appStyles.label}>Coordination notes</Text>
        <TextInput
          style={[appStyles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          value={additionalNotes}
          onChangeText={setAdditionalNotes}
          multiline
          placeholder="Context the hospital needs to coordinate this request"
        />

        <Pressable
          style={appStyles.primaryButton}
          disabled={!hospitalId || submitting}
          onPress={() => void handleSubmit()}
        >
          <Text style={appStyles.buttonText}>
            {submitting ? 'Submitting…' : 'Submit patient need'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
