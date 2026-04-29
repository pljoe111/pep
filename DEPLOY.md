# Deploying to DigitalOcean App Platform

## One-click deploy

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/YOUR_ORG/YOUR_REPO/tree/main)

> Replace the URL above with your actual GitHub repo URL after pushing.

---

## What gets deployed

| Component | Type                                   | Size (starter)       |
| --------- | -------------------------------------- | -------------------- |
| `bff`     | Docker service (Express API)           | `apps-s-1vcpu-0.5gb` |
| `fe`      | Docker service (nginx SPA + API proxy) | `apps-s-1vcpu-0.5gb` |
| `db`      | Managed PostgreSQL 16                  | `db-s-1vcpu-1gb`     |

Traffic flow: `Internet → fe (nginx :80) → /api/* proxied → bff (:3000) → db`

---

## Pre-requisites

- [doctl](https://docs.digitalocean.com/reference/doctl/how-to/install/) installed and authenticated (`doctl auth init`)
- Your repo pushed to GitHub with the `main` branch

---

## Option A — CLI deploy (recommended)

```bash
# 1. Validate the spec
doctl apps spec validate .do/app.yaml

# 2. Create the app (first deploy ~5 min)
doctl apps create --spec .do/app.yaml

# 3. Get the app ID
doctl apps list

# 4. Set secrets (replace placeholders)
APP_ID=<your-app-id>

doctl apps update $APP_ID --spec .do/app.yaml  # re-applies spec

# Set each secret via the dashboard, OR use doctl:
doctl apps update $APP_ID --set-env \
  JWT_SECRET=$(openssl rand -hex 32) \
  MASTER_WALLET_PUBLIC_KEY=<your-pubkey> \
  MASTER_WALLET_PRIVATE_KEY=<your-privkey> \
  ENCRYPTION_KEY=$(openssl rand -hex 32) \
  SMTP_USER=<your-smtp-user> \
  SMTP_PASS=<your-smtp-pass>
```

---

## Option B — Dashboard deploy

1. Go to **Apps → Create App** in the [DigitalOcean dashboard](https://cloud.digitalocean.com/apps)
2. Connect your GitHub repo → select branch `main`
3. Click **Edit Plan**, upload or paste the contents of [`.do/app.yaml`](.do/app.yaml)
4. Click **Next** — DO will detect both Dockerfiles automatically
5. On the **Env Vars** screen, fill in all `SECRET` fields (see table below)
6. Click **Create Resources** — first build takes ~5–10 min

---

## Required secrets

These must be set before the app can start. Everything else has a safe default.

| Variable                    | How to generate                                       | Required                        |
| --------------------------- | ----------------------------------------------------- | ------------------------------- |
| `JWT_SECRET`                | `openssl rand -hex 32`                                | ✅                              |
| `MASTER_WALLET_PUBLIC_KEY`  | Your Solana master wallet pubkey                      | ✅                              |
| `MASTER_WALLET_PRIVATE_KEY` | Your Solana master wallet private key (base58)        | ✅                              |
| `ENCRYPTION_KEY`            | `openssl rand -hex 32` (must be exactly 64 hex chars) | ✅                              |
| `SMTP_USER`                 | Your SMTP username / Gmail address                    | ✅ (if using nodemailer)        |
| `SMTP_PASS`                 | Your SMTP password / Gmail App Password               | ✅ (if using nodemailer)        |
| `RESEND_API_KEY`            | From [resend.com](https://resend.com) dashboard       | ✅ (if `EMAIL_PROVIDER=resend`) |
| `AWS_ACCESS_KEY_ID`         | AWS IAM key for S3 COA uploads                        | Optional                        |
| `AWS_SECRET_ACCESS_KEY`     | AWS IAM secret                                        | Optional                        |

> ⚠️ `DATABASE_URL` is **automatically injected** from the managed `db` component — do not set it manually.

---

## Post-deploy checklist

- [ ] Visit `https://<your-app>.ondigitalocean.app/health` → should return `{"status":"ok"}`
- [ ] Visit `https://<your-app>.ondigitalocean.app/api/app-info` → should return app version JSON
- [ ] Log in with the seeded admin account (`ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars, defaulting to `admin@example.com` / `yourStrongPasswordHere`)
- [ ] Change the admin password immediately
- [ ] Set `ENABLE_SWAGGER=false` in production (already defaulted to `false` in the spec)

---

## Local Docker Compose (for testing the production build)

```bash
# Copy and fill in your secrets
cp packages/bff/.env.example packages/bff/.env

# Build and start all services
docker compose up --build

# Frontend:  http://localhost:8080
# API:       http://localhost:3000/api/app-info
```

---

## Scaling

To scale the BFF horizontally, update `instance_count` in [`.do/app.yaml`](.do/app.yaml) and redeploy:

```bash
doctl apps update $APP_ID --spec .do/app.yaml
```

For production, also:

- Set `production: true` on the `db` component (enables daily backups)
- Upgrade `db` to `db-s-1vcpu-2gb` or higher
- Add a DO Spaces bucket and point `AWS_S3_BUCKET` + `AWS_S3_ENDPOINT` to it for COA uploads
