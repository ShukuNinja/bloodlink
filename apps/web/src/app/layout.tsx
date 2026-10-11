import type { Metadata } from 'next';
import { AuthSessionProvider } from './auth-session';
import './globals.css';

export const metadata: Metadata = {
  title: 'BloodLink',
  description: 'Hospital-centered blood coordination platform',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
