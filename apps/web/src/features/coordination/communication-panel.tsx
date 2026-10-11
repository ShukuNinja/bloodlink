'use client';

import { useState } from 'react';
import { ApiClientError } from '@/api/client';
import { useAuthSession } from '@/app/auth-session';
import { communicationApi } from './communication-api';
import type { ConversationDetail } from '@bloodlink/contracts';

export function CommunicationPanel({ requestId }: { requestId: string }) {
  const { user } = useAuthSession();
  const [conversation, setConversation] =
    useState<ConversationDetail | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadConversation() {
    setLoading(true);
    setError(null);
    try {
      const result = await communicationApi.getConversation(requestId);
      setConversation(result.data);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError && cause.status === 404
          ? 'The hospital makes this conversation available after selecting a responder.'
          : cause instanceof ApiClientError
            ? cause.message
            : 'Could not load this request conversation.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const messageText = content.trim();
    if (!messageText) return;
    setSending(true);
    setError(null);
    try {
      await communicationApi.sendMessage(requestId, { content: messageText });
      setContent('');
      await loadConversation();
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

  return (
    <section className="card" aria-label="Request conversation">
      <h3>Request conversation</h3>
      {!conversation ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadConversation()}
        >
          {loading ? 'Opening conversation…' : 'Open conversation'}
        </button>
      ) : (
        <>
          <ol aria-live="polite">
            {conversation.messages.map((message) => (
              <li key={message.id}>
                <strong>
                  {message.senderId === user?.id ? 'You' : 'Other participant'}
                </strong>{' '}
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
            <form onSubmit={(event) => void sendMessage(event)}>
              <div className="field">
                <label htmlFor={`message-${requestId}`}>Message</label>
                <textarea
                  id={`message-${requestId}`}
                  value={content}
                  maxLength={2000}
                  required
                  onChange={(event) => setContent(event.target.value)}
                />
              </div>
              <button type="submit" disabled={sending || !content.trim()}>
                {sending ? 'Sending…' : 'Send message'}
              </button>
            </form>
          ) : (
            <p className="muted">This conversation is closed.</p>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadConversation()}
          >
            Refresh messages
          </button>
        </>
      )}
      {error ? (
        <div className="alert error" role="alert">
          {error}{' '}
          {!conversation ? (
            <button type="button" onClick={() => void loadConversation()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
