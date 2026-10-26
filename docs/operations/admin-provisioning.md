# Admin account provisioning

Admin accounts cannot be created through web, mobile, or the public
`POST /auth/register` endpoint. Create the first Admin only through the
operator-run database provisioner.

## Provision the first Admin

Run from the repository root in PowerShell. Set `ADMIN_EMAIL` and
`ADMIN_PASSWORD` through a secure local secret mechanism; do not put real
credentials in source control or shell command history. The script reads the
API `.env` for `DIRECT_URL` or `DATABASE_URL` and prefers `DIRECT_URL` for this
one-time database operation.

```powershell
$env:ADMIN_EMAIL = 'admin@example.com'
# Set ADMIN_PASSWORD from your approved secret manager or secure environment.
pnpm --filter @bloodlink/api admin:provision
Remove-Item Env:ADMIN_EMAIL
Remove-Item Env:ADMIN_PASSWORD
```

If you do not use the pnpm script, run `node apps/api/scripts/provision-admin.cjs`
instead of the `pnpm` command above.

The provisioner creates one ACTIVE `ADMIN` user and stores a bcrypt password
hash. It does not create an organization, expose an HTTP endpoint, promote an
existing Individual, or change an existing Admin's password. Repeating the
command for an existing Admin email is a no-op; using an email owned by a
non-Admin fails without changing the account.

Review which database URL is configured before running the command. The
provisioner writes to that database and does not run migrations. No database
was changed as part of implementing this feature.
