export type StoredSession = {
  accessToken: string;
  refreshToken: string;
};

export type SessionStorageAdapter = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

const SESSION_KEY = 'bloodlink.session';
let testAdapter: SessionStorageAdapter | null = null;

async function storage(): Promise<SessionStorageAdapter> {
  if (testAdapter) return testAdapter;
  return import('expo-secure-store');
}

export async function readStoredSession(): Promise<StoredSession | null> {
  const value = await (await storage()).getItemAsync(SESSION_KEY);
  if (!value) return null;
  try {
    const session = JSON.parse(value) as Partial<StoredSession>;
    if (
      typeof session.accessToken !== 'string' ||
      typeof session.refreshToken !== 'string'
    ) {
      return null;
    }
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  } catch {
    return null;
  }
}

export async function writeStoredSession(
  session: StoredSession,
): Promise<void> {
  await (await storage()).setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function deleteStoredSession(): Promise<void> {
  await (await storage()).deleteItemAsync(SESSION_KEY);
}

/** Injects a deterministic storage adapter for transport tests. */
export function setSessionStorageAdapterForTesting(
  adapter: SessionStorageAdapter | null,
): void {
  testAdapter = adapter;
}
