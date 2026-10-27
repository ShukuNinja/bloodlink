import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScreen } from '../components/keyboard-aware-screen';
import { ApiClientError } from '../api/client';
import * as authApi from '../api/auth';
import { appStyles } from './styles';

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'register') {
        await authApi.register({ name, email, password });
      } else {
        await authApi.login({ email, password });
      }
      router.push('/hospitals');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Unexpected error',
      );
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAwareScreen>
      <Text style={appStyles.title}>
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </Text>

      {error ? (
        <View style={appStyles.errorBox}>
          <Text style={appStyles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={appStyles.card}>
        {mode === 'register' ? (
          <>
            <Text style={appStyles.label}>Your name</Text>
            <TextInput
              style={appStyles.input}
              accessibilityLabel="Your name"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              maxLength={120}
              placeholder="Full name"
            />
          </>
        ) : null}
        <Text style={appStyles.label}>Email</Text>
        <TextInput
          style={appStyles.input}
          accessibilityLabel="Email"
          value={email}
          onChangeText={setEmail}
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@example.com"
        />
        <Text style={appStyles.label}>Password</Text>
        <TextInput
          style={appStyles.input}
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 8 characters"
        />
        <Pressable
          style={appStyles.primaryButton}
          disabled={submitting || (mode === 'register' && !name.trim())}
          onPress={() => void handleSubmit()}
        >
          <Text style={appStyles.buttonText}>
            {submitting
              ? 'Working…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </Text>
        </Pressable>
        <Pressable
          style={appStyles.secondaryButton}
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          <Text style={appStyles.secondaryButtonText}>
            {mode === 'login'
              ? 'Need an account? Register'
              : 'Have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAwareScreen>
  );
}
