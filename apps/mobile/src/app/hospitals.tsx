import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useHospitalSearch } from '../features/individual/hospitals/hooks';
import { appStyles } from './styles';

export default function HospitalsScreen() {
  const router = useRouter();
  const { results, loading, error, searched, search } = useHospitalSearch();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('');
  const [query, setQuery] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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
    let radius: number | undefined;
    if (radiusMeters !== '') {
      radius = Number(radiusMeters);
      if (!Number.isFinite(radius) || radius <= 0) {
        setFormError('Search radius must be a positive number of meters.');
        return;
      }
    }

    await search({
      latitude: lat,
      longitude: lon,
      radiusMeters: radius,
      query: query.trim() || undefined,
    });
  }

  return (
    <ScrollView style={appStyles.screen}>
      <Text style={appStyles.title}>Find nearby hospitals</Text>
      <Text style={appStyles.subtitle}>
        Search uses your current coordinates. Coordinates are never stored.
      </Text>

      {formError ? (
        <View style={appStyles.errorBox}>
          <Text style={appStyles.errorText}>{formError}</Text>
        </View>
      ) : null}

      <View style={appStyles.card}>
        <Text style={appStyles.label}>Latitude</Text>
        <TextInput
          style={appStyles.input}
          value={latitude}
          onChangeText={setLatitude}
          keyboardType="numeric"
          placeholder="6.5244"
        />
        <Text style={appStyles.label}>Longitude</Text>
        <TextInput
          style={appStyles.input}
          value={longitude}
          onChangeText={setLongitude}
          keyboardType="numeric"
          placeholder="3.3792"
        />
        <Text style={appStyles.label}>Radius (meters, optional)</Text>
        <TextInput
          style={appStyles.input}
          value={radiusMeters}
          onChangeText={setRadiusMeters}
          keyboardType="numeric"
          placeholder="25000"
        />
        <Text style={appStyles.label}>Name contains (optional)</Text>
        <TextInput
          style={appStyles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="City"
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
    </ScrollView>
  );
}
