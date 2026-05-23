# Azure Deployment Runbook

This app deploys to **Azure App Service (Linux, Node 20)** via GitHub Actions.

Stack:
- Next.js 16 in **standalone output** mode (`output: 'standalone'`) — produces a self-contained `server.js` so we ship ~30 MB instead of the full `node_modules`.
- App Service is configured to run **`npm start` → `node server.js`**.
- All server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `ELEVENLABS_API_KEY`, etc.) live in **App Service Configuration**. Public values (`NEXT_PUBLIC_*`) are baked in at build time via GitHub repo variables.

---

## One-time Azure setup

You can do this in the portal or via the `az` CLI. CLI is faster — paste these into Cloud Shell or your local shell after `az login`.

```bash
# === Variables ===
RG="rg-ugsot"
LOCATION="centralindia"          # or wherever your other resources live
PLAN="asp-ugsot-linux"
APP="ugsot-dashboard"            # must be globally unique
SKU="B1"                         # B1 is enough for staging; P1v3 for prod

# === 1. Resource group ===
az group create -n $RG -l $LOCATION

# === 2. Linux App Service plan ===
az appservice plan create \
  -g $RG -n $PLAN \
  --is-linux --sku $SKU

# === 3. Web App with Node 20 ===
az webapp create \
  -g $RG -n $APP -p $PLAN \
  --runtime "NODE:20-lts"

# === 4. Startup command (runs from /home/site/wwwroot after deploy) ===
az webapp config set \
  -g $RG -n $APP \
  --startup-file "node server.js"

# === 5. Always-on so cold starts don't bite the 30s admin refresh ===
az webapp config set -g $RG -n $APP --always-on true

# === 6. App settings (env vars) ===
# Replace the right-hand sides before pasting.
az webapp config appsettings set -g $RG -n $APP --settings \
  NODE_ENV=production \
  WEBSITE_NODE_DEFAULT_VERSION=20 \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false \
  NEXT_PUBLIC_SUPABASE_URL="https://lcfkznqziubuefwnvqlb.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="<paste from Supabase>" \
  SUPABASE_SERVICE_ROLE_KEY="<paste from Supabase>" \
  N8N_WEBHOOK_SECRET="<paste>" \
  ELEVENLABS_API_KEY="<paste>" \
  AZURE_OPENAI_ENDPOINT="<paste>" \
  AZURE_OPENAI_API_KEY="<paste>" \
  AZURE_OPENAI_DEPLOYMENT="<paste>" \
  AZURE_OPENAI_API_VERSION="<paste>" \
  NEXT_PUBLIC_SENTRY_DSN="<paste if using Sentry>"
```

**Important flags explained:**
- `SCM_DO_BUILD_DURING_DEPLOYMENT=false` — we ship a pre-built standalone bundle from GitHub Actions, so Oryx (Azure's build service) should NOT try to re-build it.
- `--startup-file "node server.js"` — points at the standalone `server.js` we deploy at the wwwroot root.

---

## GitHub Actions setup

The workflow at `.github/workflows/azure-deploy.yml` runs on every push to `main` and on manual dispatch.

### Repo secrets (Settings → Secrets and variables → **Actions** → **Secrets**)

| Name | Value |
|---|---|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Full XML from **App Service → Overview → Get publish profile**. Open the downloaded `.PublishSettings` file in a text editor, copy everything, paste here. |

### Repo variables (Settings → Secrets and variables → **Actions** → **Variables**)

| Name | Example |
|---|---|
| `AZURE_WEBAPP_NAME` | `ugsot-dashboard` (matches the `$APP` you used above) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lcfkznqziubuefwnvqlb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon key) |
| `NEXT_PUBLIC_SENTRY_DSN` | (optional) |

> Variables, not secrets, because `NEXT_PUBLIC_*` is **embedded in the client bundle at build time** — there is no secrecy benefit to hiding it from CI logs.

---

## First deploy

1. Commit and push the changes to `main`.
2. Watch the workflow in the GitHub **Actions** tab. Should finish in ~3–5 min.
3. Hit `https://<APP>.azurewebsites.net` — login page.
4. Sign in with a seeded user from `dashboard_user_roles` (or create one).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Application Error` immediately on load | Startup command wrong, or `server.js` not at wwwroot root | SSH into App Service (`az webapp ssh`), run `ls /home/site/wwwroot` — should see `server.js`. If it's under `.next/standalone/`, the GHA zip step is wrong. |
| 500 on every page, logs say `NEXT_PUBLIC_SUPABASE_URL is undefined` | Missed the repo Variables step — `NEXT_PUBLIC_*` are needed **at build time** in GHA, not at runtime in App Service | Add them under Settings → Variables and re-run the workflow. |
| Auth never works in production | Supabase URL allowlist | Add `https://<APP>.azurewebsites.net/**` under Supabase → Authentication → URL Configuration → Redirect URLs. |
| 401 on `/api/admin/recording/<id>` | Cookie mismatch (App Service vs your custom domain) | If you front App Service with a custom domain, set `Site URL` on Supabase to the custom domain. |
| Recording proxy returns 502 | `ELEVENLABS_API_KEY` not configured on App Service | Add it in Configuration → Application settings. |
| Static assets (CSS, fonts) 404 | The `cp -R .next/static .next/standalone/.next/static` step didn't run | Re-check the GHA logs at the "Assemble standalone bundle" step. |
| Slow first load every few minutes | `Always-on` is off | `az webapp config set -g $RG -n $APP --always-on true` |

### Live logs

```bash
az webapp log tail -g $RG -n $APP
```

### SSH

```bash
az webapp ssh -g $RG -n $APP
# Inside the container:
ls /home/site/wwwroot/
node -v
```

---

## Promoting prod from staging

If you set up deployment slots (`az webapp deployment slot create -g $RG -n $APP -s staging`), deploy to `staging`, smoke test, then:

```bash
az webapp deployment slot swap -g $RG -n $APP --slot staging --target-slot production
```

Slot swap is atomic and instant — no downtime.

---

## Rotating secrets

App settings can be updated in place without a redeploy — App Service will restart the worker automatically:

```bash
az webapp config appsettings set -g $RG -n $APP --settings ELEVENLABS_API_KEY="<new>"
```

The Supabase service-role key and 11Labs key should be rotated on a schedule. The `N8N_WEBHOOK_SECRET` should match what's set on the n8n side — rotate both together.
