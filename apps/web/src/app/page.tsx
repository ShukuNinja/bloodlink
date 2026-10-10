import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h1>BloodLink</h1>
      <p className="muted">
        Hospital-centered blood coordination. Submit a patient need to a nearby
        hospital and track its review status.
      </p>
      <div className="card">
        <h2>Get started</h2>
        <ol>
          <li>
            <Link href="/auth">Sign in or create an account</Link>
          </li>
          <li>
            <Link href="/hospitals">Find a nearby hospital</Link>
          </li>
          <li>
            <Link href="/patient-needs/new">Submit a patient need</Link>
          </li>
          <li>
            <Link href="/patient-needs">Track your request history</Link>
          </li>
        </ol>
      </div>
    </main>
  );
}
