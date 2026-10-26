import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PatientNeedConversationDetail } from '@bloodlink/contracts';
import { ApiClientError } from '../../api/client';
import { organizationsApi } from '../organizations/api';
import { appStyles } from '../../app/styles';

export function PatientNeedConversationPanel({
  patientNeedId,
}: {
  patientNeedId: string;
}) {
  const [conversation, setConversation] =
    useState<PatientNeedConversationDetail | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWaiting(false);
    try {
      const response =
        await organizationsApi.patientNeedConversation(patientNeedId);
      setConversation(response.data);
    } catch (cause) {
      setConversation(null);
      if (cause instanceof ApiClientError && cause.status === 409)
        setWaiting(true);
      else
        setError(
          cause instanceof ApiClientError
            ? cause.message
            : 'Could not load the conversation.',
        );
    } finally {
      setLoading(false);
    }
  }, [patientNeedId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!content.trim() || !conversation) return;
    setSending(true);
    setError(null);
    try {
      await organizationsApi.sendPatientNeedMessage(patientNeedId, {
        content: content.trim(),
      });
      setContent('');
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not send message.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={appStyles.card}>
      <Text style={appStyles.title}>Hospital request chat</Text>
      {loading ? <ActivityIndicator /> : null}
      {waiting ? (
        <Text style={appStyles.muted}>
          Chat opens after the hospital verifies this need and creates a
          BloodRequest.
        </Text>
      ) : null}
      {error ? (
        <View style={appStyles.errorBox}>
          <Text style={appStyles.errorText}>{error}</Text>
        </View>
      ) : null}
      {conversation ? (
        <>
          <Text style={appStyles.muted}>
            {conversation.hospitalName} · {conversation.status}
          </Text>
          {conversation.messages.map((message) => (
            <View style={appStyles.card} key={message.id}>
              <Text style={appStyles.muted}>
                {new Date(message.createdAt).toLocaleString()}
              </Text>
              <Text>{message.content}</Text>
            </View>
          ))}
          {!conversation.messages.length ? (
            <Text style={appStyles.muted}>No messages yet.</Text>
          ) : null}
          {conversation.status === 'OPEN' ? (
            <>
              <TextInput
                style={appStyles.input}
                value={content}
                onChangeText={setContent}
                placeholder="Write a message"
                multiline
                maxLength={2000}
              />
              <Pressable
                style={appStyles.primaryButton}
                disabled={sending || !content.trim()}
                onPress={() => void send()}
              >
                <Text style={appStyles.buttonText}>
                  {sending ? 'Sending…' : 'Send message'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={appStyles.muted}>
              The request is closed. This conversation is read-only.
            </Text>
          )}
        </>
      ) : null}
    </View>
  );
}
