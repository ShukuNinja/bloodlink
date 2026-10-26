import { Link, Stack, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import type { AuthUser } from '@bloodlink/contracts';
import { isSignedIn, fetchCurrentUser } from '../api/auth';
import { colors } from './styles';

export default function RootLayout() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    if (!isSignedIn()) {
      setUser(null);
      return () => {
        active = false;
      };
    }
    void fetchCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.surface },
        headerTitle: user?.name || 'BloodLink',
        headerRight: user
          ? () => (
              <Link
                href="/profile"
                style={{ color: colors.accent, fontWeight: '600' }}
              >
                Profile
              </Link>
            )
          : undefined,
      }}
    />
  );
}
