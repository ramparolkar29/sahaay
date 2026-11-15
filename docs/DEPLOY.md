# Deploy Sahaay

Two paths: **Vercel** (fastest, what the public demo uses) or **Cloud Run** (full Google Cloud stack with Firestore email delivery). Both run the same code.

## Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new). The framework is detected as Next.js; keep the default build command.
2. Add environment variables (Production and Preview):

```bash
SESSION_SECRET=<32+ random characters>   # required, the app refuses to boot without it
CRON_SECRET=<random string>              # required, /api/cron/reminders returns 401 without it
# SAHAY_DB_PATH=/tmp/sahaay.db           # optional, this is already the default on Vercel
```

Generate the values with `openssl rand -hex 32` and `openssl rand -hex 24`.

3. Deploy. `vercel.json` registers `/api/cron/reminders` as a cron job; Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

**Storage caveat:** Vercel Functions only offer an ephemeral `/tmp`. SQLite therefore lives per instance and resets on cold starts — perfect for a seeded demo, not for real family data. For production, move `src/lib/store.ts` to Postgres (Neon), Firestore or Cloud SQL; nothing else changes.

**Cron cadence:** the Hobby plan allows one cron run per day (`0 2 * * *`). For 15-minute reminder scans on a paid plan, change the schedule in `vercel.json`; elsewhere, point any scheduler at the endpoint with the same bearer header.

### CLI deploy

```bash
npx vercel login
npx vercel link
npx vercel env add SESSION_SECRET production
npx vercel env add CRON_SECRET production
npx vercel --prod
```

## Cloud Run

Everything below is copy-paste ready. Replace `YOUR-PROJECT-ID` and the email/SMTP values with real ones.

## What gets deployed

| Piece | Google Cloud service | Purpose |
| --- | --- | --- |
| App container | Cloud Run (`asia-south1`) | Serves the Next.js app, seeds the demo circle on first boot |
| Secrets | Secret Manager | `SESSION_SECRET` (session signing), `CRON_SECRET` (cron auth) |
| Reminder scan | Cloud Scheduler | Calls `POST /api/cron/reminders` every 15 minutes |
| Email delivery | Firestore `mail` collection + Trigger Email extension | Sends queued reminders over SMTP and records delivery |
| Metrics/logs | Cloud Logging + Monitoring | Request logs, error alerting, uptime check |

The container keeps SQLite at `/tmp/sahaay.db`. Cloud Run's local disk is per-instance, so the service is pinned to one instance for the demo. A multi-instance deployment would move the repository to Firestore; see "Scaling past one instance" below.

## 0. Prerequisites

- `gcloud` CLI logged in with an Owner or Editor role on a billing-enabled project.
- `openssl` (ships with Git Bash and most shells).

```bash
export PROJECT=YOUR-PROJECT-ID
export REGION=asia-south1
export SERVICE=sahaay
gcloud config set project "$PROJECT"
```

## 1. Enable the APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com
```

## 2. Create the secrets

```bash
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create sahaay-session-secret --data-file=-
openssl rand -hex 24 | tr -d '\n' | gcloud secrets create sahaay-cron-secret --data-file=-
```

Store the cron value locally for the Scheduler step:

```bash
export CRON_SECRET=$(gcloud secrets versions access latest --secret=sahaay-cron-secret)
```

## 3. Firestore + Trigger Email

1. Create the default Firestore database in native mode (`asia-south1`) from the console: **Firestore → Create database**.
2. Install the **Trigger Email from Firestore** extension: **Firebase console → Extensions → Firestore Trigger Email**.
   - Collection: `mail`
   - SMTP connection URI: e.g. `smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465` (use an app password, never the account password)
   - Default FROM: `Sahaay <care@yourdomain.com>`
3. Grant the runtime service account Firestore access:

```bash
export PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
export RUNTIME_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$RUNTIME_SA" --role="roles/datastore.user"

gcloud secrets add-iam-policy-binding sahaay-session-secret \
  --member="serviceAccount:$RUNTIME_SA" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding sahaay-cron-secret \
  --member="serviceAccount:$RUNTIME_SA" --role="roles/secretmanager.secretAccessor"
```

If you skip this step, Sahaay still runs: reminders stay in the in-app outbox and only Firestore delivery is disabled.

## 4. Deploy

Cloud Build builds the included `Dockerfile`, so Docker is not needed locally.

```bash
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60 \
  --set-env-vars "FIRESTORE_PROJECT=$PROJECT,SAHAY_DB_PATH=/tmp/sahaay.db" \
  --set-secrets "SESSION_SECRET=sahaay-session-secret:latest,CRON_SECRET=sahaay-cron-secret:latest"
```

`min-instances 1` keeps the demo database warm between judge visits. Raise `max-instances` only after moving off SQLite.

## 5. Schedule the reminder scan

```bash
export URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')

gcloud scheduler jobs create http sahaay-reminders \
  --location "$REGION" \
  --schedule "*/15 * * * *" \
  --uri "$URL/api/cron/reminders" \
  --http-method POST \
  --headers "Authorization=Bearer $CRON_SECRET" \
  --attempt-deadline 60s
```

The endpoint also accepts `x-cron-secret`. Without either header it returns 401.

## 6. Smoke test

```bash
curl -s "$URL/" -o /dev/null -w "landing: %{http_code}\n"

curl -s -X POST "$URL/api/cron/reminders" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected JSON: `{"queued":…,"duplicates":…,"considered":…,"delivery":{"configured":true,…}}`.

Then open `$URL`, sign in with the demo caretaker passcode `2580`, and confirm the reminder outbox shows the email. A second cron call should report `queued: 0` and a duplicate.

## 7. Local container (optional)

```bash
docker build -t sahaay .
docker run --rm -p 8080:8080 -e SESSION_SECRET=local-dev-secret-at-least-32-characters sahaay
# http://localhost:8080
```

## Scaling past one instance

The repository in `src/lib/store.ts` is the only code that touches storage. To run multiple instances, implement the same methods against Firestore (or Cloud SQL) and keep SQLite for local development. The reminder engine, pages and actions call the repository contract only, so no UI changes are needed. Until then, keep `--max-instances 1`.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| 500 with `SESSION_SECRET … required` | Secret not mounted | Re-run the deploy command; check the secret has at least one version |
| Cron returns 401 | Header missing or stale `CRON_SECRET` | Re-read the secret and update the Scheduler job headers |
| Reminders queue but never send | Extension not installed, SMTP wrong, or `FIRESTORE_PROJECT` unset | Check the extension logs; verify the `mail` documents appear |
| Data resets after a deploy | Cloud Run disk is per-instance | Expected for the demo; keep one instance warm or move storage |
| `Queued` stays after delivery | Firestore rejected the write | Inspect `delivery.failed` in the cron response and the Cloud Run logs |
