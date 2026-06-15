# Battle Killboard

English Albion battle killboard with user accounts and per-user saved member lists.

## Required Cloudflare Setup

This version uses Pages Functions and D1. A simple three-file drag-and-drop deployment is no longer sufficient.

1. Open Cloudflare Dashboard → `D1 SQL Database` → select `bombsquad-db` → `Console`.
2. Paste and execute the contents of `schema.sql`.
3. Open the deployed Pages project → `Settings` → `Bindings`.
4. Add a `D1 database` binding:
   - Variable name: `DB`
   - D1 database: `bombsquad-db`
5. Redeploy the Pages project after adding the binding.

## Deploy with Wrangler

```powershell
$env:CLOUDFLARE_API_TOKEN="your-api-token"
npx wrangler pages deploy . --project-name battle-killboard
```

After deployment, confirm that the Pages project has the `DB` binding described above.

## Local Development

Initialize the local D1 database:

```powershell
npx wrangler d1 execute bombsquad-db --local --file schema.sql
```

Run the app with a local D1 binding:

```powershell
npx wrangler pages dev . --d1 DB=bombsquad-db
```

## Security

- Passwords are stored as PBKDF2-SHA256 hashes with per-user salts.
- Authentication uses Secure, HttpOnly, SameSite cookies.
- Member lists are stored in D1 and separated by authenticated user ID.
