import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { restoreSession } from '../api/client';

export default function RootLayout() {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void restoreSession()
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setSessionReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!sessionReady) return null;
  return <Stack />;
}
