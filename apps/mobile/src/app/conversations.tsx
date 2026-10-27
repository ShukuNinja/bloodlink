import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScreen } from '../components/keyboard-aware-screen';
import type {
  OrganizationConversationDetail,
  OrganizationConversationSummary,
  PatientNeedConversationSummary,
} from '@bloodlink/contracts';
import { ApiClientError } from '../api/client';
import { organizationsApi } from '../features/organizations/api';
import { appStyles } from './styles';

export default function ConversationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const conversationId =
    typeof params.conversationId === 'string'
      ? params.conversationId
      : undefined;
  const [items, setItems] = useState<OrganizationConversationSummary[]>([]);
  const [patientNeedItems, setPatientNeedItems] = useState<
    PatientNeedConversationSummary[]
  >([]);
  const [conversation, setConversation] =
    useState<OrganizationConversationDetail | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const [response, patientNeedResponse] = await Promise.all([
        organizationsApi.listConversations(),
        organizationsApi.listPatientNeedConversations(),
      ]);
      setItems(response.data);
      setPatientNeedItems(patientNeedResponse.data);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not load conversations.',
      );
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await organizationsApi.conversation(id);
      setConversation(response.data);
    } catch (cause) {
      setConversation(null);
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not open conversation.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    if (conversationId) void loadConversation(conversationId);
    else setConversation(null);
  }, [conversationId, loadConversation]);

  async function sendMessage() {
    if (!conversation || !content.trim()) return;
    setSending(true);
    setError(null);
    try {
      await organizationsApi.sendMessage(conversation.id, {
        content: content.trim(),
      });
      setContent('');
      await Promise.all([loadConversation(conversation.id), loadList()]);
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
    <KeyboardAwareScreen>
      <Text style={appStyles.title}>Conversations</Text>
      <Text style={appStyles.subtitle}>
        General conversations between hospitals and blood banks.
      </Text>
      <Link href="/organizations" style={appStyles.linkText}>
        Find organizations
      </Link>
      {error ? (
        <View style={appStyles.errorBox}>
          <Text style={appStyles.errorText}>{error}</Text>
        </View>
      ) : null}
      <View style={appStyles.card}>
        <Text style={appStyles.label}>Your conversations</Text>
        {!items.length ? (
          <Text style={appStyles.muted}>
            No organization conversations yet.
          </Text>
        ) : null}
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={appStyles.secondaryButton}
            onPress={() =>
              router.replace({
                pathname: '/conversations',
                params: { conversationId: item.id },
              })
            }
          >
            <Text style={appStyles.secondaryButtonText}>
              {item.otherOrganization.name}
            </Text>
            <Text style={appStyles.muted}>
              {item.lastMessage?.content ?? 'No messages yet'}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={appStyles.card}>
        <Text style={appStyles.label}>Blood request chats</Text>
        {!patientNeedItems.length ? (
          <Text style={appStyles.muted}>No patient request chats yet.</Text>
        ) : null}
        {patientNeedItems.map((item) => (
          <Pressable
            key={item.id}
            style={appStyles.secondaryButton}
            onPress={() =>
              router.push({
                pathname: '/patient-need-conversation',
                params: { patientNeedId: item.patientNeedId },
              })
            }
          >
            <Text style={appStyles.secondaryButtonText}>
              {item.hospitalName}
            </Text>
            <Text style={appStyles.muted}>
              Patient need · {item.status.toLowerCase()}
            </Text>
            <Text numberOfLines={1}>
              {item.lastMessage?.content ?? 'No messages yet'}
            </Text>
          </Pressable>
        ))}
      </View>
      {conversationId && loading ? <ActivityIndicator /> : null}
      {conversation ? (
        <View style={appStyles.card}>
          <Text style={appStyles.title}>
            {conversation.participantA.name} · {conversation.participantB.name}
          </Text>
          {conversation.messages.map((message) => (
            <View key={message.id} style={appStyles.card}>
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
                accessibilityLabel="Message content"
                value={content}
                onChangeText={setContent}
                placeholder="Write a message"
                multiline
                maxLength={2000}
              />
              <Pressable
                style={appStyles.primaryButton}
                disabled={sending || !content.trim()}
                onPress={() => void sendMessage()}
              >
                <Text style={appStyles.buttonText}>
                  {sending ? 'Sending…' : 'Send message'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={appStyles.muted}>This conversation is closed.</Text>
          )}
        </View>
      ) : null}
      <Link href="/subscriptions" style={appStyles.linkText}>
        Subscribed organizations
      </Link>
    </KeyboardAwareScreen>
  );
}
