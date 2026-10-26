'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type {
  OrganizationConversationDetail,
  OrganizationConversationSummary,
  PatientNeedConversationSummary,
} from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import { useAuthSession } from '@/app/auth-session';
import { organizationsApi } from '@/features/organizations/api';

export default function ConversationsPage() {
  const { user } = useAuthSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('conversationId');
  const [conversations, setConversations] = useState<
    OrganizationConversationSummary[]
  >([]);
  const [patientNeedConversations, setPatientNeedConversations] = useState<
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
      const [organizationResponse, patientNeedResponse] = await Promise.all([
        organizationsApi.listConversations(),
        organizationsApi.listPatientNeedConversations(),
      ]);
      setConversations(organizationResponse.data);
      setPatientNeedConversations(patientNeedResponse.data);
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
          : 'Could not open this conversation.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (requestedId) void loadConversation(requestedId);
    else setConversation(null);
  }, [loadConversation, requestedId]);

  async function selectConversation(id: string) {
    router.replace(`/conversations?conversationId=${encodeURIComponent(id)}`);
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          : 'Could not send this message.',
      );
    } finally {
      setSending(false);
    }
  }

  const organizationMember = (user?.organizations.length ?? 0) > 0;
  return (
    <main className="conversations-page">
      <div className="workflow-heading">
        <div>
          <p className="workflow-eyebrow">MESSAGES</p>
          <h1>Conversations</h1>
          <p className="muted">
            Organization chats and individual–hospital request coordination.
          </p>
        </div>
        <Link className="btn-link" href="/organizations">
          Find organizations
        </Link>
      </div>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="conversation-layout">
        <aside
          className="card conversation-list"
          aria-label="Conversation list"
        >
          <h2>Your conversations</h2>
          {conversations.length === 0 ? (
            <p className="muted">No organization conversations yet.</p>
          ) : (
            conversations.map((item) => (
              <button
                className={
                  conversation?.id === item.id
                    ? 'conversation-list-item selected'
                    : 'conversation-list-item'
                }
                key={item.id}
                type="button"
                onClick={() => void selectConversation(item.id)}
              >
                <strong>{item.otherOrganization.name}</strong>
                <span className="muted">
                  {item.otherOrganization.type === 'HOSPITAL'
                    ? 'Hospital'
                    : 'Blood bank'}
                </span>
                <span className="conversation-preview">
                  {item.lastMessage?.content ?? 'No messages yet'}
                </span>
              </button>
            ))
          )}
          <h2 className="conversation-list-section-title">
            Blood request chats
          </h2>
          {patientNeedConversations.length === 0 ? (
            <p className="muted">No patient request chats yet.</p>
          ) : (
            patientNeedConversations.map((item) => {
              const hospitalMember = user?.organizations.some(
                (organization) => organization.type === 'HOSPITAL',
              );
              const path = hospitalMember
                ? `/hospital/patient-needs/${item.patientNeedId}`
                : `/patient-needs/${item.patientNeedId}`;
              return (
                <Link
                  className="conversation-list-item"
                  href={path}
                  key={item.id}
                >
                  <strong>{item.hospitalName}</strong>
                  <span className="muted">
                    Patient need · {item.status.toLowerCase()}
                  </span>
                  <span className="conversation-preview">
                    {item.lastMessage?.content ?? 'No messages yet'}
                  </span>
                </Link>
              );
            })
          )}
        </aside>
        <section className="card conversation-thread" aria-label="Conversation">
          {!requestedId ? (
            <div className="workflow-empty workflow-empty-detail">
              <strong>Select a conversation</strong>
              <span>Choose a thread or find an organization to start one.</span>
            </div>
          ) : loading ? (
            <p className="muted">Loading conversation…</p>
          ) : conversation ? (
            <>
              <header className="conversation-thread-heading">
                <div>
                  <p className="workflow-eyebrow">ORGANIZATION CHAT</p>
                  <h2>
                    {conversation.participantA.name} ·{' '}
                    {conversation.participantB.name}
                  </h2>
                </div>
                <span className="badge neutral">{conversation.status}</span>
              </header>
              <ol className="conversation-messages" aria-live="polite">
                {conversation.messages.map((message) => (
                  <li
                    className={
                      message.senderId === user?.id ? 'message mine' : 'message'
                    }
                    key={message.id}
                  >
                    <strong>
                      {message.senderId === user?.id
                        ? 'You'
                        : 'Organization member'}
                    </strong>
                    <time dateTime={message.createdAt}>
                      {new Date(message.createdAt).toLocaleString()}
                    </time>
                    <p>{message.content}</p>
                  </li>
                ))}
              </ol>
              {conversation.messages.length === 0 ? (
                <p className="muted">
                  No messages yet. Start the conversation below.
                </p>
              ) : null}
              {conversation.status === 'OPEN' ? (
                <form
                  className="conversation-compose"
                  onSubmit={(event) => void sendMessage(event)}
                >
                  <label className="field">
                    <span>Message</span>
                    <textarea
                      value={content}
                      maxLength={2000}
                      required
                      onChange={(event) => setContent(event.target.value)}
                    />
                  </label>
                  <button
                    className="primary"
                    type="submit"
                    disabled={sending || !content.trim()}
                  >
                    {sending ? 'Sending…' : 'Send message'}
                  </button>
                </form>
              ) : (
                <p className="muted">This conversation is closed.</p>
              )}
            </>
          ) : null}
        </section>
      </div>
      {!organizationMember && !conversations.length ? (
        <p className="muted">
          Individual conversations are available from an active blood request.
        </p>
      ) : null}
    </main>
  );
}
