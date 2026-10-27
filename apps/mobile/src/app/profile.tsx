import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScreen } from '../components/keyboard-aware-screen';
import { ApiClientError } from '../api/client';
import * as authApi from '../api/auth';
import { appStyles } from './styles';

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void authApi
      .fetchCurrentUser()
      .then((user) => setName(user.name ?? ''))
      .catch(() => setError('Could not load your account.'));
  }, []);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await authApi.updateAccountName(name.trim());
      setNotice('Your name has been updated.');
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not update your name.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAwareScreen>
      <Text style={appStyles.title}>Your account</Text>
      <View style={appStyles.card}>
        <Text style={appStyles.label}>Name</Text>
        <TextInput
          style={appStyles.input}
          accessibilityLabel="Your name"
          value={name}
          onChangeText={setName}
          maxLength={120}
          autoComplete="name"
          placeholder="Full name"
        />
        {error ? (
          <View style={appStyles.errorBox}>
            <Text style={appStyles.errorText}>{error}</Text>
          </View>
        ) : null}
        {notice ? (
          <View style={appStyles.successBox}>
            <Text style={appStyles.successText}>{notice}</Text>
          </View>
        ) : null}
        <Pressable
          style={appStyles.primaryButton}
          disabled={saving || !name.trim()}
          onPress={() => void save()}
        >
          <Text style={appStyles.buttonText}>
            {saving ? 'Saving…' : 'Save name'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAwareScreen>
  );
}
