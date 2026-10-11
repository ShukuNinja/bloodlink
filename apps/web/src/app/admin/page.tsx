'use client';

import { useEffect, useState } from 'react';
import type {
  AdminAccountListResponse,
  AdminMetrics,
  AdminOrganizationListResponse,
} from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import { adminApi } from './api';

type DashboardData = {
  metrics: AdminMetrics;
  accounts: AdminAccountListResponse;
  organizations: AdminOrganizationListResponse;
};

export default function AdminWorkspacePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [accountPage, setAccountPage] = useState(1);
  const [organizationPage, setOrganizationPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      adminApi.getMetrics(),
      adminApi.listAccounts(accountPage),
      adminApi.listOrganizations(organizationPage),
    ])
      .then(([metrics, accounts, organizations]) => {
        if (active) {
          setData({ metrics: metrics.data, accounts, organizations });
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiClientError
              ? cause.message
              : 'Could not load the admin dashboard.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountPage, organizationPage, retry]);

  if (loading && !data) {
    return (
      <main aria-live="polite">
        <h1>Admin dashboard</h1>
        <p className="muted">Loading platform records…</p>
      </main>
    );
  }
  if (error && !data) {
    return (
      <main>
        <h1>Admin dashboard</h1>
        <div className="alert error" role="alert">
          {error}
        </div>
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          Retry
        </button>
      </main>
    );
  }
  if (!data) return null;

  const { metrics, accounts, organizations } = data;
  return (
    <main>
      <h1>Admin dashboard</h1>
      <p className="muted">
        Current platform metrics and records. This view does not contain a
        historical event audit trail.
      </p>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      <p className="muted">
        Metrics generated {new Date(metrics.generatedAt).toLocaleString()}.
      </p>
      <section className="card" aria-labelledby="metrics-title">
        <h2 id="metrics-title">Platform metrics</h2>
        <div className="row">
          <Metric title="Accounts" value={metrics.accounts.total} />
          <Metric title="Individuals" value={metrics.accounts.individuals} />
          <Metric title="Admins" value={metrics.accounts.admins} />
          <Metric title="Active accounts" value={metrics.accounts.active} />
          <Metric title="Hospitals" value={metrics.organizations.hospitals} />
          <Metric
            title="Blood banks"
            value={metrics.organizations.bloodCentres}
          />
          <Metric
            title="Patient needs"
            value={metrics.workflows.patientNeeds}
          />
          <Metric
            title="Blood requests"
            value={metrics.workflows.bloodRequests}
          />
          <Metric
            title="Individuals who volunteered"
            value={metrics.workflows.individualResponders}
          />
          <Metric
            title="Donor responses"
            value={metrics.workflows.donorResponses}
          />
          <Metric
            title="Organization responses"
            value={metrics.workflows.organizationResponses}
          />
          <Metric
            title="Hospital subscriptions"
            value={metrics.workflows.hospitalSubscriptions}
          />
          <Metric
            title="Donation records"
            value={metrics.workflows.donationRecords}
          />
        </div>
      </section>

      <section className="card" aria-labelledby="accounts-title">
        <h2 id="accounts-title">Account records</h2>
        {accounts.data.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Account access</th>
                  <th>Status</th>
                  <th>Organizations</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {accounts.data.map((account) => (
                  <tr key={account.id}>
                    <td>{account.email}</td>
                    <td>{formatAccountAccess(account)}</td>
                    <td>{account.status}</td>
                    <td>
                      {account.organizations.length
                        ? account.organizations
                            .map(
                              (organization) =>
                                `${organization.name} (${organization.type}, ${organization.membershipStatus})`,
                            )
                            .join(', ')
                        : '—'}
                    </td>
                    <td>{new Date(account.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No accounts have been registered.</p>
        )}
        <Pagination
          page={accounts.meta.page}
          totalPages={accounts.meta.totalPages}
          onChange={setAccountPage}
        />
      </section>

      <section className="card" aria-labelledby="organizations-title">
        <h2 id="organizations-title">Organization records</h2>
        {organizations.data.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Members</th>
                  <th>Created</th>
                  <th>Last updated</th>
                </tr>
              </thead>
              <tbody>
                {organizations.data.map((organization) => (
                  <tr key={organization.id}>
                    <td>{organization.name}</td>
                    <td>{organization.type}</td>
                    <td>{organization.status}</td>
                    <td>{organization.memberCount}</td>
                    <td>{new Date(organization.createdAt).toLocaleString()}</td>
                    <td>{new Date(organization.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No organizations have been registered.</p>
        )}
        <Pagination
          page={organizations.meta.page}
          totalPages={organizations.meta.totalPages}
          onChange={setOrganizationPage}
        />
      </section>
    </main>
  );
}

function formatAccountAccess(account: AdminAccountListResponse['data'][number]) {
  if (account.role === 'ADMIN') return 'Admin';
  if (account.organizations.length === 0) return 'Individual';
  return account.organizations
    .map((organization) => {
      const organizationType =
        organization.type === 'HOSPITAL' ? 'Hospital' : 'Blood Centre';
      const membershipRole = organization.role.endsWith('_ADMIN')
        ? 'Admin'
        : 'Staff';
      return `${organizationType} ${membershipRole}`;
    })
    .join(', ');
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{value.toLocaleString()}</p>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="row" aria-label="Pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span className="muted">
        Page {page} of {Math.max(totalPages, 1)}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
