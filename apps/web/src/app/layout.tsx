import type { Metadata } from 'next';
import Link from 'next/link';
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
        <header className="nav">
          <strong>BloodLink</strong>
          <Link href="/hospitals">Find hospitals</Link>
          <Link href="/patient-needs/new">New request</Link>
          <Link href="/patient-needs">My requests</Link>
          <Link href="/auth">Sign in</Link>
        </header>
        {children}
      </body>
    </html>
  );
}
