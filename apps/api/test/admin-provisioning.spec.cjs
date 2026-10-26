/* global require */
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const bcrypt = require('bcryptjs');
const {
  ProvisioningError,
  provisionAdmin,
  readProvisioningInput,
} = require('../scripts/provision-admin.cjs');

class FakeClient {
  constructor(rows = []) {
    this.rows = rows;
    this.queries = [];
  }

  async query(sql, values = []) {
    this.queries.push({ sql, values });
    if (sql.startsWith('SELECT')) return { rows: this.rows };
    return { rows: [] };
  }
}

describe('Admin provisioning', () => {
  it('validates and normalizes operator-supplied credentials', () => {
    assert.deepEqual(
      readProvisioningInput({
        DIRECT_URL: 'postgres://db.example.test/app',
        ADMIN_EMAIL: '  Admin@Example.test ',
        ADMIN_PASSWORD: 'a-safe-test-password',
      }),
      {
        connectionString: 'postgres://db.example.test/app',
        email: 'admin@example.test',
        password: 'a-safe-test-password',
      },
    );
    assert.throws(
      () => readProvisioningInput({ ADMIN_EMAIL: 'admin@example.test' }),
      ProvisioningError,
    );
    assert.throws(
      () =>
        readProvisioningInput({
          DIRECT_URL: 'postgres://db.example.test/app',
          ADMIN_EMAIL: 'bad..address@example.test',
          ADMIN_PASSWORD: 'a-safe-test-password',
        }),
      ProvisioningError,
    );
  });

  it('creates one ACTIVE Admin with a bcrypt password hash in a transaction', async () => {
    const client = new FakeClient();
    const result = await provisionAdmin({
      client,
      email: ' Admin@Example.test ',
      password: 'a-safe-test-password',
    });
    const insert = client.queries.find(({ sql }) => sql.startsWith('INSERT'));

    assert.equal(result.created, true);
    assert.match(result.id, /^[0-9a-f-]{36}$/i);
    assert.deepEqual(
      client.queries.map(({ sql }) => sql.split(/\s+/)[0]),
      ['BEGIN', 'SELECT', 'INSERT', 'COMMIT'],
    );
    assert.equal(insert.values[0], result.id);
    assert.equal(insert.values[1], 'admin@example.test');
    assert.equal(
      await bcrypt.compare('a-safe-test-password', insert.values[2]),
      true,
    );
    assert.notEqual(insert.values[2], 'a-safe-test-password');
    assert.match(insert.sql, /'ADMIN'::"UserRole"/);
    assert.match(insert.sql, /'ACTIVE'::"UserStatus"/);
  });

  it('is idempotent for an existing Admin and does not reset credentials', async () => {
    const client = new FakeClient([{ id: 'existing-admin', role: 'ADMIN' }]);
    const result = await provisionAdmin({
      client,
      email: 'admin@example.test',
      password: 'a-safe-test-password',
    });

    assert.deepEqual(result, { created: false, id: 'existing-admin' });
    assert.deepEqual(
      client.queries.map(({ sql }) => sql),
      [
        'BEGIN',
        'SELECT "id", "role" FROM "User" WHERE "email" = $1 FOR UPDATE',
        'ROLLBACK',
      ],
    );
  });

  it('refuses to promote an existing non-Admin account', async () => {
    const client = new FakeClient([{ id: 'individual', role: 'INDIVIDUAL' }]);

    await assert.rejects(
      provisionAdmin({
        client,
        email: 'user@example.test',
        password: 'a-safe-test-password',
      }),
      /refusing to change its role/,
    );
    assert.equal(client.queries.at(-1).sql, 'ROLLBACK');
    assert.equal(
      client.queries.some(({ sql }) => sql.startsWith('INSERT')),
      false,
    );
  });
});
