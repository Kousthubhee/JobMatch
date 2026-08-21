import { useRef, useState } from "react";
import { useApp } from "../state/store";
import type { Provider } from "../lib/types";
import { extractPdfText } from "../lib/pdfParse";
import { DEFAULT_MODELS, testKey } from "../lib/llm";
import { getGoogleToken, testDriveConnection, testSheetConnection } from "../lib/google";
import { toast } from "../components/ui";
import {
  IconCheck, IconDoc, IconDrive, IconEye, IconEyeOff, IconKey, IconSheet, IconSpinner,
  IconTrash, IconUpload, IconX,
} from "../components/icons";

const PROVIDERS: { id: Provider; name: string; hint: string }[] = [
  { id: "openai", name: "OpenAI", hint: "api.openai.com — GPT models" },
  { id: "gemini", name: "Google Gemini", hint: "aistudio.google.com — Gemini models" },
  { id: "openrouter", name: "OpenRouter", hint: "openrouter.ai — Claude, Llama, Mistral & more" },
];

export default function ProfileView({ goGuide }: { goGuide: () => void }) {
  const app = useApp();
  const p = app.profile;

  const [showKey, setShowKey] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [googleResult, setGoogleResult] = useState<string[]>([]);
  const pdfInput = useRef<HTMLInputElement>(null);
  const texInput = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<typeof p>) => app.patchProfile(patch);

  /* ---------- resume ---------- */
  const onPdf = async (f: File | undefined) => {
    if (!f) return;
    setParsing(true);
    try {
      const text = await extractPdfText(f);
      app.setResume({
        fileName: f.name,
        text,
        texSource: app.resume?.texSource ?? "",
        addedAt: Date.now(),
      });
      toast(`Master resume parsed — ${text.length.toLocaleString()} characters`, "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not parse PDF", "err");
    } finally {
      setParsing(false);
      if (pdfInput.current) pdfInput.current.value = "";
    }
  };

  const onTex = async (f: File | undefined) => {
    if (!f) return;
    const texSource = await f.text();
    app.setResume({
      fileName: app.resume?.fileName ?? f.name,
      text: app.resume?.text ?? "",
      texSource,
      addedAt: app.resume?.addedAt ?? Date.now(),
    });
    toast("LaTeX source saved alongside your resume", "ok");
    if (texInput.current) texInput.current.value = "";
  };

  /* ---------- LLM ---------- */
  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const out = await testKey(p);
      setTestResult({ ok: true, text: `Key works — model replied “${out}”` });
      toast("API key verified", "ok");
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  /* ---------- google ---------- */
  const connect = async () => {
    setConnecting(true);
    const lines: string[] = [];
    setGoogleResult([]);
    try {
      if (!p.oauthClientId.trim()) throw new Error("Paste your OAuth Client ID first (Setup Guide, step 3).");
      lines.push("Opening Google consent screen…");
      setGoogleResult([...lines]);
      const token = await getGoogleToken(p.oauthClientId.trim(), true);
      lines.push("Authorized ✓ — token received");
      if (p.sheetId.trim()) {
        try {
          const title = await testSheetConnection(token, p.sheetId.trim());
          lines.push(`Google Sheet connected ✓ — “${title}”`);
        } catch (e) {
          lines.push(`Google Sheet ✗ — ${e instanceof Error ? e.message : "failed"}`);
        }
      } else {
        lines.push("Google Sheet — ID not set, skipped");
      }
      if (p.driveFolderId.trim()) {
        try {
          const name = await testDriveConnection(token, p.driveFolderId.trim());
          lines.push(`Drive folder connected ✓ — “${name}”`);
        } catch (e) {
          lines.push(`Drive folder ✗ — ${e instanceof Error ? e.message : "failed"}`);
        }
      } else {
        lines.push("Drive folder — ID not set, skipped");
      }
    } catch (e) {
      lines.push(`✗ ${e instanceof Error ? e.message : "Connection failed"}`);
    } finally {
      setGoogleResult(lines);
      setConnecting(false);
    }
  };

  return (
    <div className="anim-fade-up max-w-4xl">
      <div className="mb-7">
        <div className="label-mono !text-moss mb-2">profile & connections</div>
        <h1 className="font-display font-bold text-[34px] leading-[1.05] tracking-tight">
          Your setup, stored locally.
        </h1>
        <p className="text-[13.5px] text-ink2 mt-2 max-w-xl leading-relaxed">
          Everything below persists in your browser's IndexedDB — restart the app, reboot the machine,
          it's all still here. Nothing is sent anywhere except the APIs you configure.
        </p>
      </div>

      {/* -------- master resume -------- */}
      <section className="panel p-6 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-display font-bold text-xl flex items-center gap-2.5">
              <IconDoc size={20} className="text-moss" /> Master resume
            </h2>
            <p className="text-[13px] text-ink2 mt-1">
              Upload the PDF (parsed to structured text) — and the raw <span className="font-mono text-[12px]">.tex</span> source
              if you have it, since tailored output is LaTeX.
            </p>
          </div>
          {app.resume && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                app.setResume(null);
                toast("Master resume deleted", "info");
              }}
            >
              <IconTrash size={14} /> Delete
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button className="btn btn-primary" onClick={() => pdfInput.current?.click()} disabled={parsing}>
            {parsing ? <IconSpinner size={15} /> : <IconUpload size={15} />}
            {parsing ? "Parsing PDF…" : app.resume ? "Replace PDF" : "Upload PDF"}
          </button>
          <button className="btn btn-outline" onClick={() => texInput.current?.click()}>
            <IconUpload size={15} /> {app.resume?.texSource ? "Replace .tex source" : "Upload .tex source"}
          </button>
          <input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void onPdf(e.target.files?.[0])} />
          <input ref={texInput} type="file" accept=".tex,text/plain" className="hidden" onChange={(e) => void onTex(e.target.files?.[0])} />
        </div>

        {app.resume ? (
          <div className="mt-5 grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-linesoft bg-white/70 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="label-mono">parsed text · {app.resume.fileName}</span>
                <span className="font-mono text-[11px] text-moss">
                  {app.resume.text ? `${app.resume.text.length.toLocaleString()} chars ✓` : "empty"}
                </span>
              </div>
              <pre className="text-[11.5px] leading-relaxed text-ink2 max-h-40 overflow-auto scroll-thin whitespace-pre-wrap font-mono">
                {app.resume.text ? app.resume.text.slice(0, 900) + (app.resume.text.length > 900 ? "\n…" : "") : "No text extracted — upload a text-based PDF."}
              </pre>
            </div>
            <div className="rounded-lg border border-linesoft bg-white/70 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="label-mono">latex source</span>
                <span className="font-mono text-[11px] text-moss">
                  {app.resume.texSource ? `${app.resume.texSource.length.toLocaleString()} chars ✓` : "not provided"}
                </span>
              </div>
              <pre className="text-[11.5px] leading-relaxed text-ink2 max-h-40 overflow-auto scroll-thin whitespace-pre-wrap font-mono">
                {app.resume.texSource ? app.resume.texSource.slice(0, 900) + (app.resume.texSource.length > 900 ? "\n…" : "") : "Optional — the tailored resume ships with its own ATS-safe LaTeX template either way."}
              </pre>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-line bg-white/50 px-5 py-6 text-center">
            <p className="text-[13px] text-ink3">
              No resume yet. The match score, keyword chips, and generation all depend on it.
            </p>
          </div>
        )}
        <div className="mt-3 text-[12px] text-ink3 font-mono">
          {app.resume ? `saved ${new Date(app.resume.addedAt).toLocaleString()} · persists across restarts` : "stored in IndexedDB · never leaves this machine"}
        </div>
      </section>

      {/* -------- LLM provider -------- */}
      <section className="panel p-6 mb-5">
        <h2 className="font-display font-bold text-xl flex items-center gap-2.5 mb-1">
          <IconKey size={20} className="text-moss" /> LLM provider
        </h2>
        <p className="text-[13px] text-ink2 mb-4">
          Used <em>only</em> for tailoring generation (resume rewrite + cover letter). JD parsing and ATS matching run locally.
        </p>

        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          {PROVIDERS.map((pr) => (
            <button
              key={pr.id}
              onClick={() => {
                set({ provider: pr.id });
                toast(`Provider → ${pr.name}`, "info");
              }}
              className={`text-left rounded-lg border px-4 py-3 transition-all duration-150 hover:-translate-y-0.5 ${
                p.provider === pr.id
                  ? "border-moss bg-mosslight shadow-[0_6px_16px_-8px_rgba(16,107,69,0.5)]"
                  : "border-line bg-white/60 hover:border-ink2"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[14px]">{pr.name}</span>
                {p.provider === pr.id && <IconCheck size={15} className="text-moss" strokeWidth={2.6} />}
              </div>
              <div className="text-[11.5px] text-ink3 mt-1">{pr.hint}</div>
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-[1fr_240px] gap-4">
          <div>
            <label className="label-mono block mb-1.5">api key</label>
            <div className="relative">
              <input
                className="input pr-11 font-mono !text-[12.5px]"
                type={showKey ? "text" : "password"}
                placeholder={p.provider === "openai" ? "sk-…" : p.provider === "gemini" ? "AIza…" : "sk-or-…"}
                value={p.apiKey}
                onChange={(e) => set({ apiKey: e.target.value })}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink3 hover:text-ink transition-colors"
                onClick={() => setShowKey((v) => !v)}
                aria-label="Toggle key visibility"
              >
                {showKey ? <IconEyeOff size={17} /> : <IconEye size={17} />}
              </button>
            </div>
            <p className="text-[11.5px] text-ink3 mt-1.5">
              Stored only in this browser's local database. Calls go directly from your machine to {PROVIDERS.find((x) => x.id === p.provider)?.name}.
            </p>
          </div>
          <div>
            <label className="label-mono block mb-1.5">model</label>
            <input
              className="input font-mono !text-[12.5px]"
              placeholder={DEFAULT_MODELS[p.provider]}
              value={p.model}
              onChange={(e) => set({ model: e.target.value })}
              spellCheck={false}
            />
            <p className="text-[11.5px] text-ink3 mt-1.5">blank = {DEFAULT_MODELS[p.provider]}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <button className="btn btn-primary" onClick={() => void runTest()} disabled={testing || !p.apiKey.trim()}>
            {testing ? <IconSpinner size={15} /> : <IconKey size={15} />}
            {testing ? "Testing…" : "Test key"}
          </button>
          {testResult && (
            <span className={`text-[12.5px] font-mono flex items-center gap-1.5 ${testResult.ok ? "text-moss" : "text-coral"}`}>
              {testResult.ok ? <IconCheck size={14} strokeWidth={2.4} /> : <IconX size={14} strokeWidth={2.4} />}
              {testResult.text}
            </span>
          )}
        </div>
      </section>

      {/* -------- google -------- */}
      <section className="panel p-6 mb-5">
        <h2 className="font-display font-bold text-xl flex items-center gap-2.5 mb-1">
          <IconDrive size={20} className="text-moss" /> Google Sheet & Drive
        </h2>
        <p className="text-[13px] text-ink2 mb-4">
          Optional. When connected, confirming a tracker row also appends it to your Sheet and uploads both PDFs to your Drive folder.
          New here? <button className="underline font-semibold text-moss hover:text-mossdeep" onClick={goGuide}>Open the step-by-step Setup Guide</button>.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label-mono block mb-1.5">oauth client id</label>
            <input
              className="input font-mono !text-[12px]"
              placeholder="123456…-abcd.apps.googleusercontent.com"
              value={p.oauthClientId}
              onChange={(e) => set({ oauthClientId: e.target.value })}
              spellCheck={false}
            />
          </div>
          <div>
            <label className="label-mono block mb-1.5 flex items-center gap-1.5"><IconSheet size={12} /> sheet id</label>
            <input
              className="input font-mono !text-[12px]"
              placeholder="from the Sheet URL"
              value={p.sheetId}
              onChange={(e) => set({ sheetId: e.target.value })}
              spellCheck={false}
            />
          </div>
          <div>
            <label className="label-mono block mb-1.5 flex items-center gap-1.5"><IconDrive size={12} /> drive folder id</label>
            <input
              className="input font-mono !text-[12px]"
              placeholder="from the folder URL"
              value={p.driveFolderId}
              onChange={(e) => set({ driveFolderId: e.target.value })}
              spellCheck={false}
            />
          </div>
        </div>
        <p className="text-[11.5px] text-ink3 mt-2 font-mono">
          sheet URL: docs.google.com/spreadsheets/d/<strong className="text-ink2">SHEET_ID</strong>/edit · drive URL: drive.google.com/drive/folders/<strong className="text-ink2">FOLDER_ID</strong>
        </p>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <button className="btn btn-primary" onClick={() => void connect()} disabled={connecting}>
            {connecting ? <IconSpinner size={15} /> : <IconDrive size={15} />}
            {connecting ? "Authorizing…" : "Connect & test"}
          </button>
          <span className="text-[12px] text-ink3">A Google consent popup will open — that's the first-run authorization.</span>
        </div>

        {googleResult.length > 0 && (
          <pre className="mt-4 rounded-lg bg-night text-[#c9cfc2] font-mono text-[11.5px] leading-relaxed px-4 py-3 whitespace-pre-wrap anim-pop">
            {googleResult.join("\n")}
          </pre>
        )}
      </section>
    </div>
  );
}
