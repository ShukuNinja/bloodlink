import { Link, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatDistanceMeters } from '@bloodlink/ui';
import { KeyboardAwareScreen } from '../components/keyboard-aware-screen';
import { useHospitalSearch } from '../features/individual/hospitals/hooks';
import {
  DeviceLocationError,
  parseRadiusKilometres,
  requestDeviceCoordinates,
} from '../features/individual/hospitals/location';
import { appStyles } from './styles';

export default function HospitalsScreen() {
  const router = useRouter();
  const { results, loading, error, searched, search } = useHospitalSearch();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusKilometres, setRadiusKilometres] = useState('');
  const [query, setQuery] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  async function handleUseMyLocation() {
    setLocationError(null);
    setLocating(true);
    try {
      const coordinates = await requestDeviceCoordinates(
        Location,
        Location.Accuracy.Balanced,
      );
      setLatitude(String(coordinates.latitude));
      setLongitude(String(coordinates.longitude));
    } catch (error) {
      setLocationError(
        error instanceof DeviceLocationError
          ? error.message
          : 'Could not determine your location. Enter coordinates manually or retry.',
      );
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    setFormError(null);
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (
      latitude === '' ||
      longitude === '' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      setFormError('Latitude and longitude are required numbers.');
      return;
    }
    if (lat < -90 || lat > 90) {
      setFormError('Latitude must be between -90 and 90.');
      return;
    }
    if (lon < -180 || lon > 180) {
      setFormError('Longitude must be between -180 and 180.');
      return;
    }
    const radius = parseRadiusKilometres(radiusKilometres);
    if (!radius.ok) {
      setFormError(radius.message);
      return;
    }

    await search({
      latitude: lat,
      longitude: lon,
      radiusMeters: radius.value,
      query: query.trim() || undefined,
    });
  }

  return (
    <KeyboardAwareScreen>
      <Text style={appStyles.title}>Find nearby hospitals</Text>
      <Text style={appStyles.subtitle}>
        Search uses your current coordinates. Coordinates are never stored.
      </Text>

      {formError ? (
        <View style={appStyles.errorBox}>
          <Text style={appStyles.errorText}>{formError}</Text>
        </View>
      ) : null}
      {locationError ? (
        <View style={appStyles.errorBox} accessibilityRole="alert">
          <Text style={appStyles.errorText}>{locationError}</Text>
        </View>
      ) : null}

      <View style={appStyles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          style={appStyles.secondaryButton}
          disabled={locating}
          onPress={() => void handleUseMyLocation()}
        >
          <Text style={appStyles.secondaryButtonText}>
            {locating ? 'Getting location…' : 'Use my location'}
          </Text>
        </Pressable>
        <Text style={appStyles.muted}>
          Location is requested only when you choose this button. If access is
          denied or unavailable, you can enter coordinates below.
        </Text>
        <Text style={appStyles.label}>Latitude</Text>
        <TextInput
          style={appStyles.input}
          accessibilityLabel="Latitude"
          value={latitude}
          onChangeText={setLatitude}
          keyboardType="numeric"
          placeholder="6.5244"
        />
        <Text style={appStyles.label}>Longitude</Text>
        <TextInput
          style={appStyles.input}
          accessibilityLabel="Longitude"
          value={longitude}
          onChangeText={setLongitude}
          keyboardType="numeric"
          placeholder="3.3792"
        />
        <Text style={appStyles.label}>
          Search radius (kilometres, optional)
        </Text>
        <TextInput
          style={appStyles.input}
          accessibilityLabel="Search radius in kilometres"
          value={radiusKilometres}
          onChangeText={setRadiusKilometres}
          keyboardType="decimal-pad"
          placeholder="25 (API default)"
        />
        <Text style={appStyles.label}>Name contains (optional)</Text>
        <TextInput
          style={appStyles.input}
          accessibilityLabel="Hospital name filter"
          value={query}
          onChangeText={setQuery}
          placeholder="Hospital name"
        />
        <Pressable
          style={appStyles.primaryButton}
          disabled={loading}
          onPress={() => void handleSubmit()}
        >
          <Text style={appStyles.buttonText}>
            {loading ? 'Searching…' : 'Search hospitals'}
          </Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator /> : null}

      {error ? (
        error.isUnauthorized ? (
          <View style={appStyles.errorBox}>
            <Text style={appStyles.errorText}>
              You need to sign in to search hospitals.
            </Text>
            <Link style={appStyles.linkText} href="/auth">
              Sign in
            </Link>
          </View>
        ) : (
          <View style={appStyles.errorBox}>
            <Text style={appStyles.errorText}>{error.message}</Text>
          </View>
        )
      ) : null}

      {searched && !loading && !error && results && results.length === 0 ? (
        <View style={appStyles.card}>
          <Text>No hospitals found in this area. Try a wider radius.</Text>
        </View>
      ) : null}

      {results && results.length > 0
        ? results.map((hospital) => (
            <View key={hospital.id} style={appStyles.card}>
              <Text style={{ fontWeight: '700' }}>{hospital.name}</Text>
              <Text style={appStyles.muted}>
                {formatDistanceMeters(hospital.distanceMeters)} away
              </Text>
              <Text style={appStyles.muted}>
                {hospital.latitude.toFixed(4)}, {hospital.longitude.toFixed(4)}
              </Text>
              <Pressable
                style={appStyles.primaryButton}
                onPress={() =>
                  router.push({
                    pathname: '/patient-needs/new',
                    params: {
                      hospitalId: hospital.id,
                      hospitalName: hospital.name,
                    },
                  })
                }
              >
                <Text style={appStyles.buttonText}>Select</Text>
              </Pressable>
            </View>
          ))
        : null}
    </KeyboardAwareScreen>
  );
}
