import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '@bloodlink/contracts';
import { fetchCurrentUser, isSignedIn, signOut } from '../api/auth';
import { subscribeToSessionChanges } from '../api/client';
import { colors, appStyles } from './styles';
import { getMobileNavigationItems } from './navigation';

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionRevision, setSessionRevision] = useState(0);

  useEffect(
    () =>
      subscribeToSessionChanges(() => {
        setSessionRevision((revision) => revision + 1);
        if (!isSignedIn()) setUser(null);
      }),
    [],
  );

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
  }, [pathname, sessionRevision]);

  const navigationItems = getMobileNavigationItems(user);

  function navigate(href: (typeof navigationItems)[number]['href']) {
    setDrawerOpen(false);
    router.push(href);
  }

  function handleSignOut() {
    signOut();
    setUser(null);
    setDrawerOpen(false);
    router.dismissAll();
    router.replace('/auth');
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.surface },
          headerTitle: user?.name || 'BloodLink',
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open navigation menu"
              accessibilityHint="Shows pages available to your account"
              hitSlop={10}
              onPress={() => setDrawerOpen(true)}
              style={{ paddingRight: 14, paddingVertical: 8 }}
            >
              <Text style={{ color: colors.ink, fontSize: 24 }}>☰</Text>
            </Pressable>
          ),
        }}
      />
      <Modal
        visible={drawerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <SafeAreaView
            accessibilityViewIsModal
            style={{
              width: 320,
              maxWidth: 360,
              flexShrink: 1,
              backgroundColor: colors.card,
              padding: 20,
            }}
          >
            <View style={appStyles.row}>
              <Text style={appStyles.title}>BloodLink menu</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close navigation menu"
                hitSlop={10}
                onPress={() => setDrawerOpen(false)}
              >
                <Text style={{ color: colors.ink, fontSize: 22 }}>×</Text>
              </Pressable>
            </View>
            {user ? (
              <Text style={appStyles.muted}>
                Signed in as {user.name || user.email}
              </Text>
            ) : (
              <Text style={appStyles.muted}>
                You are signed out. Sign in to access account pages.
              </Text>
            )}
            {navigationItems.map((item) => (
              <Pressable
                key={item.href}
                accessibilityRole="button"
                accessibilityState={{ selected: pathname === item.href }}
                style={[
                  appStyles.secondaryButton,
                  pathname === item.href && appStyles.optionChipSelected,
                ]}
                onPress={() => navigate(item.href)}
              >
                <Text style={appStyles.secondaryButtonText}>{item.label}</Text>
              </Pressable>
            ))}
            {user ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                style={appStyles.dangerButton}
                onPress={handleSignOut}
              >
                <Text style={appStyles.dangerButtonText}>Sign out</Text>
              </Pressable>
            ) : null}
          </SafeAreaView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close navigation menu"
            style={{ flex: 1, backgroundColor: '#00000066' }}
            onPress={() => setDrawerOpen(false)}
          />
        </View>
      </Modal>
    </>
  );
}
