'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthUser } from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import * as authApi from '@/api/auth';
import { canAccessRoute } from './auth-routing';

type SessionStatus = 'loading' | 'authenticated' | 'anonymous' | 'error';

type AuthSessionValue = {
  status: SessionStatus;
  user: AuthUser | null;
  restoreError: string | null;
  acceptUser: (user: AuthUser) => void;
  markSignedOut: () => void;
  restore: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const restore = useCallback(async () => {
    setStatus('loading');
    setRestoreError(null);
    try {
      const currentUser = await authApi.fetchCurrentUser();
      setUser(currentUser);
      setStatus('authenticated');
    } catch (error) {
      setUser(null);
      if (error instanceof ApiClientError && error.isUnauthorized) {
        setStatus('anonymous');
        return;
      }
      setRestoreError(
        'Could not restore your session. Check your connection and retry.',
      );
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void restore();
    const handleExpired = () => {
      setUser(null);
      setStatus('anonymous');
      setRestoreError(null);
    };
    window.addEventListener('bloodlink:session-expired', handleExpired);
    return () =>
      window.removeEventListener('bloodlink:session-expired', handleExpired);
  }, [restore]);

  const acceptUser = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
    setRestoreError(null);
    setStatus('authenticated');
  }, []);

  const markSignedOut = useCallback(() => {
    setUser(null);
    setRestoreError(null);
    setStatus('anonymous');
  }, []);

  return (
    <AuthSessionContext.Provider
      value={{ status, user, restoreError, acceptUser, markSignedOut, restore }}
    >
      <AppNavigation />
      <AuthGate>{children}</AuthGate>
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionValue {
  const session = useContext(AuthSessionContext);
  if (!session) throw new Error('AuthSessionProvider is missing');
  return session;
}

function AppNavigation() {
  const { status, user, markSignedOut } = useAuthSession();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await authApi.signOut();
    } catch {
      setSignOutError(
        'Your local session ended, but the server could not confirm sign out.',
      );
    } finally {
      markSignedOut();
      router.replace('/');
    }
  }

  return (
    <>
      <header className="nav">
        <Link href="/" aria-label="BloodLink home">
          <strong>BloodLink</strong>
        </Link>
        {status === 'authenticated' ? (
          <>
            {user?.role === 'INDIVIDUAL' && user.organizations.length === 0 ? (
              <>
                <Link href="/hospitals">Find hospitals</Link>
                <Link href="/patient-needs/new">New patient need</Link>
                <Link href="/patient-needs">My patient needs</Link>
                <Link href="/donor">Blood requests</Link>
                <Link href="/notifications">Notifications</Link>
              </>
            ) : null}
            {user?.organizations.some(
              (organization) => organization.type === 'HOSPITAL',
            ) ? (
              <Link href="/hospital/patient-needs">Hospital workspace</Link>
            ) : null}
            {user?.organizations.some(
              (organization) => organization.type === 'BLOOD_CENTRE',
            ) ? (
              <Link href="/blood-centre">Blood bank workspace</Link>
            ) : null}
            {user?.role === 'ADMIN' ? <Link href="/admin">Admin</Link> : null}
            <span className="muted">{user?.email}</span>
            <button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </>
        ) : status === 'loading' ? (
          <span className="muted" aria-live="polite">
            Restoring session…
          </span>
        ) : (
          <Link href="/auth">Sign in</Link>
        )}
      </header>
      {signOutError ? (
        <p className="alert error" role="alert">
          {signOutError}
        </p>
      ) : null}
    </>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, restoreError, restore, user } = useAuthSession();
  const protectedRoute =
    pathname === '/hospitals' ||
    pathname.startsWith('/donor') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/patient-needs') ||
    pathname.startsWith('/hospital') ||
    pathname.startsWith('/blood-centre') ||
    pathname.startsWith('/admin');
  const allowed =
    !protectedRoute || Boolean(user && canAccessRoute(user, pathname));

  useEffect(() => {
    if (protectedRoute && status === 'anonymous') {
      router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, protectedRoute, router, status]);

  if (status === 'authenticated' && !allowed) {
    return (
      <main>
        <div className="alert error" role="alert">
          This account type does not have access to this workspace.
        </div>
        <Link href="/">Return home</Link>
      </main>
    );
  }
  if (!protectedRoute || status === 'authenticated') return children;
  if (status === 'error') {
    return (
      <main>
        <div className="alert error" role="alert">
          {restoreError}
        </div>
        <button type="button" onClick={() => void restore()}>
          Retry session restore
        </button>
        <p>
          <Link href="/auth">Sign in</Link>
        </p>
      </main>
    );
  }
  return (
    <main aria-live="polite">
      <p className="muted">
        {status === 'loading'
          ? 'Checking your session…'
          : 'Taking you to sign in…'}
      </p>
    </main>
  );
}
