import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
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
import {
  isRequiredByInFuture,
  hasRequiredDateTime,
  serializeRequiredBy,
} from '../../features/individual/patient-needs/date-time';
import { KeyboardAwareScreen } from '../../components/keyboard-aware-screen';
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
  const [patientName, setPatientName] = useState('');
  const [component, setComponent] =
    useState<PatientNeedComponent>('WHOLE_BLOOD');
  const [units, setUnits] = useState('1');
  const [urgency, setUrgency] = useState<PatientNeedUrgency>('ROUTINE');
  const [requiredBy, setRequiredBy] = useState<Date | null>(null);
  const [requiredDateSelected, setRequiredDateSelected] = useState(false);
  const [requiredTimeSelected, setRequiredTimeSelected] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const { submitting, created, error, create } = useCreatePatientNeed();

  async function handleSubmit() {
    setFormError(null);
    if (!hospitalId) {
      setFormError('Select a hospital first.');
      return;
    }
    const requiredByIso = serializeRequiredBy(requiredBy);
    if (
      !requiredByIso ||
      !hasRequiredDateTime(requiredDateSelected, requiredTimeSelected)
    ) {
      setFormError('Choose both a valid required-by date and time.');
      return;
    }
    if (!requiredBy || !isRequiredByInFuture(requiredBy)) {
      setFormError('Required-by must be in the future.');
      return;
    }
    const unitsNumber = Number(units);
    if (!Number.isInteger(unitsNumber) || unitsNumber <= 0) {
      setFormError('Units must be a positive whole number.');
      return;
    }

    await create({
      hospitalId,
      patientName,
      bloodGroup,
      component,
      units: unitsNumber,
      urgency,
      requiredBy: requiredByIso,
      additionalNotes,
    });
  }

  function handleDateTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'dismissed' || !selected || !pickerMode) {
      if (Platform.OS === 'android') setPickerMode(null);
      return;
    }

    setRequiredBy((current) => {
      const next = current ? new Date(current) : new Date(selected);
      if (pickerMode === 'date') {
        next.setFullYear(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate(),
        );
        if (!current) next.setHours(12, 0, 0, 0);
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      return next;
    });
    if (pickerMode === 'date') setRequiredDateSelected(true);
    else setRequiredTimeSelected(true);

    if (Platform.OS === 'android') setPickerMode(null);
  }

  if (created) {
    return (
      <KeyboardAwareScreen>
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
      </KeyboardAwareScreen>
    );
  }

  const issues = validationIssues(error);

  return (
    <KeyboardAwareScreen>
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
        <Text style={appStyles.label}>Patient name</Text>
        <TextInput
          style={appStyles.input}
          accessibilityLabel="Patient name"
          value={patientName}
          onChangeText={setPatientName}
          maxLength={120}
          placeholder="Name of the patient"
        />
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
          accessibilityLabel="Number of units"
          value={units}
          onChangeText={setUnits}
          keyboardType="numeric"
        />

        <Text style={appStyles.label}>Required by (your local time)</Text>
        <View style={appStyles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose required-by date"
            style={appStyles.secondaryButton}
            onPress={() => setPickerMode('date')}
          >
            <Text style={appStyles.secondaryButtonText}>
              {requiredBy ? requiredBy.toLocaleDateString() : 'Choose date'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose required-by time"
            style={appStyles.secondaryButton}
            onPress={() => setPickerMode('time')}
          >
            <Text style={appStyles.secondaryButtonText}>
              {requiredBy
                ? requiredBy.toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'Choose time'}
            </Text>
          </Pressable>
        </View>
        {pickerMode ? (
          <View accessibilityLabel={`Required-by ${pickerMode} picker`}>
            <DateTimePicker
              value={requiredBy ?? new Date()}
              mode={pickerMode}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={pickerMode === 'date' ? new Date() : undefined}
              onChange={handleDateTimeChange}
            />
            {Platform.OS === 'ios' ? (
              <Pressable
                accessibilityRole="button"
                style={appStyles.secondaryButton}
                onPress={() => setPickerMode(null)}
              >
                <Text style={appStyles.secondaryButtonText}>Done</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Text style={appStyles.label}>Coordination notes</Text>
        <TextInput
          style={[appStyles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          accessibilityLabel="Coordination notes"
          value={additionalNotes}
          onChangeText={setAdditionalNotes}
          multiline
          placeholder="Context the hospital needs to coordinate this request"
        />

        <Pressable
          style={appStyles.primaryButton}
          disabled={!hospitalId || !patientName.trim() || submitting}
          onPress={() => void handleSubmit()}
        >
          <Text style={appStyles.buttonText}>
            {submitting ? 'Submitting…' : 'Submit patient need'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAwareScreen>
  );
}
