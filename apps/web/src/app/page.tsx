import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Hospital-verified blood coordination</p>
        <h1>
          Right blood, right place, <em>right now.</em>
        </h1>
        <p className="lede">
          Hospital-centered blood coordination. Submit a patient need to a
          nearby hospital and track its review status.
        </p>
        <div className="hero-actions">
          <Link href="/auth" className="btn-link primary">
            Sign in or create an account
          </Link>
          <Link href="/hospitals" className="btn-link">
            Find a nearby hospital
          </Link>
        </div>
      </section>

      <div className="card" style={{ marginTop: 40 }}>
        <h2>Get started</h2>
        <ol className="steps">
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
