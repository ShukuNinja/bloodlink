'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PatientNeedConversationDetail } from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import { useAuthSession } from '@/app/auth-session';
import { organizationsApi } from '@/features/organizations/api';

export function PatientNeedConversationPanel({
  patientNeedId,
}: {
  patientNeedId: string;
}) {
  const { user } = useAuthSession();
  const [conversation, setConversation] =
    useState<PatientNeedConversationDetail | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForReview, setWaitingForReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWaitingForReview(false);
    try {
      const result =
        await organizationsApi.patientNeedConversation(patientNeedId);
      setConversation(result.data);
    } catch (cause) {
      setConversation(null);
      if (cause instanceof ApiClientError && cause.status === 409) {
        setWaitingForReview(true);
      } else {
        setError(
          cause instanceof ApiClientError
            ? cause.message
            : 'Could not load this request conversation.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [patientNeedId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversation || !content.trim()) return;
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
          : 'Could not send this message.',
      );
      if (cause instanceof ApiClientError && cause.status === 409) await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      className="card patient-need-conversation"
      aria-label="Patient need conversation"
    >
      <header className="conversation-thread-heading">
        <div>
          <p className="workflow-eyebrow">REQUEST COORDINATION</p>
          <h2>Chat with {conversation?.hospitalName ?? 'the hospital'}</h2>
        </div>
        {conversation ? (
          <span className="badge neutral">{conversation.status}</span>
        ) : null}
      </header>
      {loading ? <p className="muted">Loading conversation…</p> : null}
      {waitingForReview ? (
        <p className="muted">
          Chat opens after the hospital verifies this patient need and creates
          its blood request.
        </p>
      ) : null}
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      {conversation ? (
        <>
          <ol className="conversation-messages" aria-live="polite">
            {conversation.messages.map((message) => (
              <li
                className={
                  message.senderId === user?.id ? 'message mine' : 'message'
                }
                key={message.id}
              >
                <strong>
                  {message.senderId === user?.id ? 'You' : 'Hospital staff'}
                </strong>
                <time dateTime={message.createdAt}>
                  {new Date(message.createdAt).toLocaleString()}
                </time>
                <p>{message.content}</p>
              </li>
            ))}
          </ol>
          {!conversation.messages.length ? (
            <p className="muted">No messages yet.</p>
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
            <p className="muted">
              The blood request is fulfilled or closed. This conversation is
              read-only.
            </p>
          )}
          <button type="button" onClick={() => void load()} disabled={loading}>
            Refresh conversation
          </button>
        </>
      ) : null}
    </section>
  );
}
