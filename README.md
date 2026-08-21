# Matchbook — ATS Resume Tailoring & Application Tracker

A local-first web app for tailoring your resume to job descriptions, scoring ATS keyword match, generating a tailored
resume (LaTeX) + cover letter (PDF), and tracking every application — with optional Google Sheets/Drive archiving.

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview    # serves dist/ at http://localhost:4173
```

## How it works

1. **Profile → Master resume.** Upload your resume PDF (parsed to structured text with pdf.js). Optionally attach the
   raw `.tex` source — tailored output is LaTeX-first: you always get an ATS-safe single-column `.tex` file you can
   compile locally (`pdflatex`/`tectonic`), plus a matching PDF rendered in-app.
2. **Tailor → paste a JD.** The app locally extracts Company, Role, Location, Work Mode, Salary, Visa Sponsorship
   (yes / no / constraints — never guessed; blank when absent), contact email, posted date, and applicant counts.
   It then runs a deterministic ATS match: Match Score % plus matched vs. missing keyword breakdown.
3. **Review the score**, then choose to tailor. You pick which missing keywords to emphasize (chips); the LLM rewrites
   phrasing and the summary — it is instructed to **never invent** skills, employers, dates, numbers, or achievements.
4. **Export & track.** Download the resume PDF, cover letter PDF, and LaTeX source. Confirming adds a row to your
   tracker (Date, Company, Role, Link — empty for you to fill later, Location, Match, Work Mode, Salary, Posted,
   Applicants, Visa, Email) and, if Google is connected, appends the row to your Sheet and uploads both PDFs to your
   Drive folder.

## Persistence

Everything (resume, API key, provider, Sheet/Drive IDs, tracker rows, even a half-finished tailoring session) is stored
in the browser's **IndexedDB** — a real local database. Restart the dev server or reboot: nothing is lost. Only
clearing site data for localhost resets the app.

## LLM providers (Profile page)

- **OpenAI** — key from `platform.openai.com/api-keys` (default model `gpt-4o-mini`)
- **Google Gemini** — key from `aistudio.google.com/apikey` (default `gemini-2.0-flash`)
- **OpenRouter** — key from `openrouter.ai/keys` (e.g. `anthropic/claude-3.5-haiku`)

Calls go straight from your browser to the provider; keys never leave this machine otherwise. Use **Test key** to verify.

## Google Sheets + Drive setup (step-by-step)

Matchbook uses **client-side OAuth** (Google Identity Services) — the right fit for a local single-user tool: no service
account, no JSON key files, no sharing your Sheet with a robot email. You authorize your own Google account once.

### 1. Create a Google Cloud project & enable APIs

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with the account that owns your
   target Sheet and Drive folder.
2. Project dropdown (top bar) → **New Project** → name it e.g. `matchbook` → **Create**.
3. **APIs & Services → Library** → search **Google Sheets API** → **Enable**.
4. Back to Library → search **Google Drive API** → **Enable**.

### 2. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen** → choose **External** → Create.
2. App name: `Matchbook`, your email for support. Scopes: you can skip adding scopes here (they're requested at runtime).
3. **Test users**: add your own Google email. While the app is in *Testing* mode, **only test users can authorize** —
   this is the #1 cause of "Access denied".

### 3. Create the OAuth Client ID (where the credentials live)

1. **APIs & Services → Credentials → + Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized JavaScript origins** — add the origin you run the app on:

   ```
   http://localhost:5173
   ```

   (Also add `http://localhost:4173` if you serve the built app via `npm run preview`.)
4. Leave *Authorized redirect URIs* empty — the implicit/token flow used here doesn't redirect.
5. **Create** → copy the **Client ID** (ends in `.apps.googleusercontent.com`). There is no secret to store.
6. Paste the Client ID into the app: **Profile → Google Sheet & Drive → OAuth Client ID**.

### 4. Find your Sheet ID and Drive Folder ID

- **Sheet:** create a Google Sheet; its ID is the token in the URL:
  `https://docs.google.com/spreadsheets/d/`**`1AbC2…xyz`**`/edit#gid=0`
  Keep the tracker on the **first tab** (a header row with the column names below is optional — rows append after data):
  `Date, Company, Role, Link, Location, Match %, Work Mode, Salary, Posted, Applicants, Visa Sponsorship, Email`
- **Drive folder:** create a folder (e.g. "Applications"); its ID is the token after `/folders/`:
  `https://drive.google.com/drive/folders/`**`1XyZ9…zyxw`**`?usp=sharing`

Paste both into the Profile page.

### 5. First-run authorization & verification

1. In Profile, click **Connect & test**. A consent popup opens.
2. Google warns "Google hasn't verified this app" (normal for personal apps): **Advanced → Go to Matchbook (unsafe) → Allow**.
3. The log should show `Google Sheet connected ✓ — "Your sheet name"` and `Drive folder connected ✓ — "Applications"`.
4. End-to-end check: run a tailoring (the sample JD works), click **"Yes, add it"** — a row appears in the Sheet and two
   PDFs land in the Drive folder.

### Scopes requested

- `https://www.googleapis.com/auth/spreadsheets` — append rows to your sheet.
- `https://www.googleapis.com/auth/drive` — upload the generated PDFs into the folder you specify.

Tokens live only in your browser's localStorage (~1h expiry; the app silently re-authorizes when needed).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Error 400: origin_mismatch` | Your runtime origin isn't in *Authorized JavaScript origins*. Add exactly `http://localhost:5173` (and `:4173` for preview), wait ~1 min, retry. |
| "Access denied" after choosing account | App is in *Testing* mode — add yourself as a **test user** on the OAuth consent screen. |
| Sheet test: `403 PERMISSION_DENIED` | You authorized with a different Google account than the Sheet owner, or the Sheets API isn't enabled. |
| Drive upload: `404` on folder | Wrong folder ID (copy the token after `/folders/`, without `?usp=sharing`), or folder belongs to another account. Tokens are cached ~1h — click **Connect & test** to refresh. |
| Wrong scopes errors | Disconnect, re-run **Connect & test** to re-issue the token with both scopes. |
| Rows append below a gap / wrong tab | Keep the tracker on the first tab; rows append after the last filled row of that tab. |
| PDF has no text when uploaded | Upload a text-based PDF (not a scan), or provide the `.tex` source. |
| Generation fails with key/model errors | Key prefixes: OpenAI `sk-`, Gemini `AIza-`, OpenRouter `sk-or-`. Verify the model name matches the provider. |

## Privacy & honesty guarantees

- All parsing and matching is local and deterministic; fields not present in a JD are left **blank, never guessed**.
- The generation prompt forbids inventing skills, employers, dates, metrics, or achievements; employers/titles/dates are
  carried over verbatim from your master resume.
