# Deploying to DigitalOcean App Platform

No CLI tools required — everything is done through the DigitalOcean dashboard.

---

## One-click deploy (after pushing to GitHub)

1. Push this repo to GitHub (any branch, e.g. `main`)
2. Open [https://cloud.digitalocean.com/apps/new](https://cloud.digitalocean.com/apps/new)
3. Click **GitHub** → authorize → select your repo + branch
4. Click **Next** — DO will detect the two Dockerfiles automatically
5. On the **Resources** screen you will see `bff` and `fe` services — leave defaults
6. On the **Environment Variables** screen, fill in the secrets listed below
7. Click **Create Resources** — first build takes ~5–10 min

Your app will be live at `https://<app-name>.ondigitalocean.app`

---

## What gets deployed

| Component | Type                                      | Monthly cost (starter) |
| --------- | ----------------------------------------- | ---------------------- |
| `bff`     | Docker service — Express API              | ~$5                    |
| `fe`      | Docker service — nginx SPA + `/api` proxy | ~$5                    |
| `db`      | Managed PostgreSQL 16                     | ~$15                   |

**Traffic flow:** `Browser → fe (nginx :80) → /api/* proxied to bff (:3000) → PostgreSQL`

The `fe` and `bff` services communicate over DO's **private network** — the BFF port is never exposed to the internet directly.

---

## Environment variables to set in the dashboard

Go to **App → Settings → App-Level Environment Variables** and add:

### Required secrets (click the 🔒 "Secret" toggle for each)

| Variable                    | Value                                                                         |
| --------------------------- | ----------------------------------------------------------------------------- |
| `JWT_SECRET`                | Any random 32+ character string — e.g. paste output of `openssl rand -hex 32` |
| `MASTER_WALLET_PUBLIC_KEY`  | Your Solana master wallet public key                                          |
| `MASTER_WALLET_PRIVATE_KEY` | Your Solana master wallet private key (base58)                                |
| `ENCRYPTION_KEY`            | Exactly 64 hex characters — e.g. `openssl rand -hex 32`                       |
| `SMTP_USER`                 | Your Gmail address (or SMTP username)                                         |
| `SMTP_PASS`                 | Your Gmail App Password (not your account password)                           |

### Optional secrets

| Variable                | Value                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`        | From [resend.com](https://resend.com) — only needed if you change `EMAIL_PROVIDER` to `resend` |
| `AWS_ACCESS_KEY_ID`     | AWS IAM key — only needed for COA file uploads to S3                                           |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret                                                                                 |

### Everything else has safe defaults

`DATABASE_URL` is **automatically injected** from the managed `db` component — do not set it manually.

All other variables (`SOLANA_RPC_URL`, `USDC_MINT`, `USDT_MINT`, etc.) are pre-filled in [`.do/app.yaml`](.do/app.yaml) with mainnet defaults and can be changed in the dashboard after deploy.

---

## Post-deploy checklist

- [ ] `https://<your-app>.ondigitalocean.app/health` → `{"status":"ok"}`
- [ ] `https://<your-app>.ondigitalocean.app/api/app-info` → JSON with version
- [ ] Log in with the seeded admin account (`admin@example.com` / `yourStrongPasswordHere`)
- [ ] **Change the admin password immediately** via the Account page
- [ ] Verify email sending works (trigger a password reset)

---

## How to generate secrets on macOS (no tools needed except Terminal)

```bash
# JWT_SECRET and ENCRYPTION_KEY — run each, copy the output
openssl rand -hex 32
openssl rand -hex 32
```

---

## Local Docker Compose (test the production build locally)

```bash
# 1. Copy the example env file and fill in your values
cp packages/bff/.env.example packages/bff/.env

# 2. Build and start everything
docker compose up --build

# Frontend:  http://localhost:8080
# API:       http://localhost:3000/api/app-info
```

---

## Scaling & production hardening

| Setting                   | Where                           | Recommendation                          |
| ------------------------- | ------------------------------- | --------------------------------------- |
| `instance_count` on `bff` | Dashboard → bff → Edit Plan     | Set to 2+ for HA                        |
| `db` size                 | Dashboard → db → Resize         | `db-s-1vcpu-2gb` minimum for production |
| `production: true` on db  | [``.do/app.yaml`](.do/app.yaml) | Enables daily backups                   |
| `ENABLE_SWAGGER`          | bff env vars                    | Already `false` in spec                 |
| S3 for COA uploads        | Add `AWS_*` env vars            | Use DO Spaces (S3-compatible)           |
