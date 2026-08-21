import { CopyBtn } from "../components/ui";
import { IconBook, IconKey } from "../components/icons";

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Create a Google Cloud project & enable the APIs",
    body: (
      <>
        <P>Go to <B>console.cloud.google.com</B> and sign in with the Google account that owns your target Sheet and Drive folder.</P>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Project dropdown (top bar) → <B>New Project</B> → name it <Code>matchbook</Code> → <B>Create</B>.</li>
          <li><B>APIs & Services → Library</B> → search <Code>Google Sheets API</Code> → <B>Enable</B>.</li>
          <li>Back to Library → search <Code>Google Drive API</Code> → <B>Enable</B>.</li>
        </ol>
      </>
    ),
  },
  {
    title: "Configure the OAuth consent screen",
    body: (
      <>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li><B>APIs & Services → OAuth consent screen</B> → choose <B>External</B> → Create.</li>
          <li>App name <Code>Matchbook</Code>, your email for support. You can skip adding scopes (they're requested at runtime).</li>
          <li>
            <B>Test users:</B> add your own Google email. While the app is in <B>Testing</B> mode, only test users can
            authorize — this is the #1 cause of “Access denied”.
          </li>
        </ol>
      </>
    ),
  },
  {
    title: "Create the OAuth Client ID",
    body: (
      <>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li><B>APIs & Services → Credentials → + Create credentials → OAuth client ID</B>.</li>
          <li>Application type: <B>Web application</B>.</li>
          <li>
            Under <B>Authorized JavaScript origins</B>, add the origin you run the app on:
            <div className="code-block mt-2 mb-1">http://localhost:5173</div>
            (Also add <Code>http://localhost:4173</Code> if you serve the built app with <Code>npm run preview</Code>.)
          </li>
          <li>Leave <B>Authorized redirect URIs</B> empty — the token flow used here doesn't redirect.</li>
          <li><B>Create</B> → copy the <B>Client ID</B> (ends in <Code>.apps.googleusercontent.com</Code>). There is no secret to store.</li>
        </ol>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-mosslight border border-[rgba(16,107,69,0.3)] px-3.5 py-2.5 text-[13px] text-mossdeep font-medium">
          Paste it here: <b>Profile → Google Sheet & Drive → OAuth Client ID</b>
        </div>
      </>
    ),
  },
  {
    title: "Find your Sheet ID and Drive Folder ID",
    body: (
      <>
        <P><B>Sheet</B> — create a Google Sheet; its ID is the token in the URL:</P>
        <div className="code-block">
          {"https://docs.google.com/spreadsheets/d/"}<span className="text-[#7fd0a4]">1AbC2…xyz</span>{"/edit#gid=0"}
        </div>
        <P className="mt-3">
          Keep the tracker on the <B>first tab</B>. Rows append after existing data; a header row with these columns is optional:
        </P>
        <div className="flex items-start gap-2 mt-1">
          <div className="code-block flex-1">Date, Company, Role, Link, Location, Match %, Work Mode, Salary, Posted, Applicants, Visa Sponsorship, Email</div>
        </div>
        <P className="mt-3"><B>Drive folder</B> — create a folder (e.g. “Applications”); its ID follows <Code>/folders/</Code>:</P>
        <div className="code-block">
          {"https://drive.google.com/drive/folders/"}<span className="text-[#7fd0a4]">1XyZ9…zyxw</span>{"?usp=sharing"}
        </div>
        <P className="mt-3">Paste both IDs into the Profile page.</P>
      </>
    ),
  },
  {
    title: "First-run authorization & verification",
    body: (
      <>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>In Profile, click <B>Connect & test</B>. A Google consent popup opens.</li>
          <li>
            “Google hasn't verified this app” is normal for personal apps: <B>Advanced → Go to Matchbook (unsafe) → Allow</B>.
          </li>
          <li>
            The log should show <Code className="!text-[#7fd0a4]">Google Sheet connected ✓</Code> and{" "}
            <Code className="!text-[#7fd0a4]">Drive folder connected ✓</Code>.
          </li>
          <li>
            End-to-end check: run a tailoring (the sample JD works), click <B>“Yes, add it”</B> — a row appears in the
            Sheet and both PDFs land in the Drive folder.
          </li>
        </ol>
        <P className="mt-3">Scopes requested:</P>
        <div className="code-block">
          {"https://www.googleapis.com/auth/spreadsheets\nhttps://www.googleapis.com/auth/drive"}
        </div>
        <P className="mt-2 text-ink3">
          Tokens live only in your browser's localStorage (~1h expiry; the app re-authorizes automatically when needed).
        </P>
      </>
    ),
  },
];

const TROUBLE: [string, string][] = [
  ["Error 400: origin_mismatch", "Your runtime origin isn't in Authorized JavaScript origins. Add exactly http://localhost:5173 (and :4173 for preview), wait ~1 min, retry."],
  ["“Access denied” after choosing account", "The app is in Testing mode — add yourself as a test user on the OAuth consent screen."],
  ["Sheet test: 403 PERMISSION_DENIED", "You authorized with a different Google account than the Sheet owner, or the Sheets API isn't enabled for the project."],
  ["Drive upload: 404 on folder", "Wrong folder ID (copy the token after /folders/, without ?usp=sharing), or the folder belongs to another account. Tokens are cached ~1h — click Connect & test to refresh."],
  ["Wrong scopes errors", "Disconnect, then re-run Connect & test to re-issue the token with both scopes."],
  ["Rows append below a gap / wrong tab", "Keep the tracker on the first tab; rows append after the last filled row of that tab."],
  ["PDF has no text when uploaded", "Upload a text-based PDF (not a scan), or provide the .tex source instead."],
  ["Generation fails with key/model errors", "Key prefixes: OpenAI sk-, Gemini AIza-, OpenRouter sk-or-. Check the model name matches the provider."],
];

export default function GuideView({ goProfile }: { goProfile: () => void }) {
  return (
    <div className="anim-fade-up max-w-3xl">
      <div className="mb-7">
        <div className="label-mono !text-moss mb-2 flex items-center gap-2">
          <IconBook size={14} /> setup guide
        </div>
        <h1 className="font-display font-bold text-[34px] leading-[1.05] tracking-tight">
          Connect Google in five steps.
        </h1>
        <p className="text-[13.5px] text-ink2 mt-2 max-w-xl leading-relaxed">
          Matchbook uses client-side OAuth (Google Identity Services) — the right fit for a local single-user tool:
          no service account, no JSON key files, no sharing your Sheet with a robot email. You authorize your own account once.
        </p>
      </div>

      <div className="space-y-5 stagger">
        {STEPS.map((s, i) => (
          <section key={s.title} className="panel p-6">
            <div className="flex items-center gap-3.5 mb-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-night text-bone font-display font-bold text-[15px]">
                {i + 1}
              </span>
              <h2 className="font-display font-bold text-[18px] tracking-tight">{s.title}</h2>
            </div>
            <div className="text-[13.5px] text-ink2 leading-relaxed pl-[50px]">{s.body}</div>
          </section>
        ))}

        <section className="panel p-6">
          <h2 className="font-display font-bold text-[18px] tracking-tight mb-4">Troubleshooting</h2>
          <div className="space-y-2.5">
            {TROUBLE.map(([symptom, fix]) => (
              <details key={symptom} className="group rounded-lg border border-linesoft bg-white/60 open:bg-white transition-colors">
                <summary className="cursor-pointer select-none px-4 py-3 text-[13.5px] font-semibold flex items-center justify-between gap-3">
                  {symptom}
                  <span className="text-ink3 group-open:rotate-90 transition-transform duration-200 text-[11px]">▶</span>
                </summary>
                <p className="px-4 pb-3.5 text-[13px] text-ink2 leading-relaxed">{fix}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-[rgba(16,107,69,0.35)] bg-mosslight px-6 py-5">
          <div>
            <div className="font-display font-bold text-[16px] text-mossdeep">Ready with your Client ID?</div>
            <div className="text-[12.5px] text-[#3c6b52] mt-0.5">Paste it, add the Sheet & Drive IDs, then hit Connect & test.</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-moss" onClick={goProfile}>
              <IconKey size={15} /> Open Profile
            </button>
            <CopyBtn text={window.location.origin} label="Copy origin URL" />
          </div>
        </div>
      </div>
    </div>
  );
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`my-2 ${className}`}>{children}</p>;
}
function B({ children }: { children: React.ReactNode }) {
  return <strong className="text-ink font-semibold">{children}</strong>;
}
function Code({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <code className={`font-mono text-[12px] text-moss ${className}`}>{children}</code>;
}
