/*
 * OWNER: D1
 * PURPOSE: Explicitly create the initial platform Admin account.
 * INPUT: DATABASE_URL or DIRECT_URL, ADMIN_EMAIL, ADMIN_PASSWORD.
 * OUTPUT: One ACTIVE User with role ADMIN, or an idempotent already-provisioned result.
 * AUTHORIZATION: Operator with database credentials; never exposed as an API route.
 * DEPENDENCIES: pg, bcryptjs, dotenv.
 * STATE CHANGES: Inserts a single User row when its normalized email is unused.
 * NON-RESPONSIBILITIES: Promoting accounts, resetting passwords, creating organizations, or changing migrations.
 */
/* global process, console, Buffer, require, module, __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { randomUUID } = require('node:crypto');
const path = require('node:path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const BCRYPT_ROUNDS = 12;
const EMAIL_PATTERN =
  /^[^\s@.]+(?:\.[^\s@.]+)*@(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/i;

class ProvisioningError extends Error {}

function readProvisioningInput(env = process.env) {
  const email =
    typeof env.ADMIN_EMAIL === 'string'
      ? env.ADMIN_EMAIL.trim().toLowerCase()
      : '';
  const password = env.ADMIN_PASSWORD;
  const connectionString = env.DIRECT_URL || env.DATABASE_URL;

  if (!connectionString) {
    throw new ProvisioningError(
      'Set DIRECT_URL or DATABASE_URL before provisioning.',
    );
  }
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw new ProvisioningError('Set ADMIN_EMAIL to a valid email address.');
  }
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new ProvisioningError('ADMIN_PASSWORD must be 8–72 bytes.');
  }

  return { connectionString, email, password };
}

async function provisionAdmin({ client, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  await client.query('BEGIN');
  try {
    const existing = await client.query(
      'SELECT "id", "role" FROM "User" WHERE "email" = $1 FOR UPDATE',
      [normalizedEmail],
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].role === 'ADMIN') {
        await client.query('ROLLBACK');
        return { created: false, id: existing.rows[0].id };
      }
      throw new ProvisioningError(
        'An account already uses this email; refusing to change its role.',
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = randomUUID();
    await client.query(
      `INSERT INTO "User"
        ("id", "email", "passwordHash", "role", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ADMIN'::"UserRole", 'ACTIVE'::"UserStatus", NOW(), NOW())`,
      [id, normalizedEmail, passwordHash],
    );
    await client.query('COMMIT');
    return { created: true, id };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof ProvisioningError) throw error;
    if (error && error.code === '23505') {
      throw new ProvisioningError(
        'An account already uses this email; no role or password was changed.',
      );
    }
    throw new ProvisioningError(
      'Admin provisioning failed; database details and credentials were not logged.',
    );
  }
}

async function main() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  let input;
  try {
    input = readProvisioningInput();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString: input.connectionString });
  try {
    await client.connect();
    const result = await provisionAdmin({
      client,
      email: input.email,
      password: input.password,
    });
    console.log(
      result.created
        ? `Provisioned Admin account ${input.email}.`
        : `Admin account ${input.email} is already provisioned; no changes made.`,
    );
  } catch (error) {
    console.error(
      error instanceof ProvisioningError
        ? error.message
        : 'Could not connect or provision Admin; database details and credentials were not logged.',
    );
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  void main();
}

module.exports = { ProvisioningError, provisionAdmin, readProvisioningInput };
