import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../state/store";
import type { Application, Session } from "../lib/types";
import { parseJD, SAMPLE_JD } from "../lib/jdParser";
import { scoreMatch } from "../lib/matcher";
import { generateTailored } from "../lib/llm";
import { renderResumePDF, renderCoverPDF, downloadBlob, sanitizeName } from "../lib/pdf";
import { appendTrackerRow, getGoogleToken, uploadToDrive } from "../lib/google";
import { Docket, ScoreRing, Stepper, bandLabel, toast } from "../components/ui";
import {
  IconAlert, IconArrowL, IconArrowR, IconCheck, IconDoc, IconDownload, IconFlame,
  IconPlus, IconScan, IconSpark, IconSpinner, IconTable,
} from "../components/icons";

const GEN_MSGS = [
  "Contacting provider…",
  "Reading your master resume…",
  "Mapping JD keywords…",
  "Rewriting bullets for this role…",
  "Drafting the cover letter…",
  "Verifying nothing was invented…",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TailorView({ goProfile, goTracker }: { goProfile: () => void; goTracker: () => void }) {
  const app = useApp();
  const s = app.session;
  // functional patch: always merges into the latest persisted session,
  // so rapid async updates (tracker save, google archive) never clobber each other
  const patch = (p: Partial<Session>) => app.setSession((prev) => ({ ...prev, ...p }));

  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState(GEN_MSGS[0]);
  const [tab, setTab] = useState<"resume" | "cover" | "latex">("resume");
  const msgTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (msgTimer.current) window.clearInterval(msgTimer.current);
    },
    []
  );

  /* ---------------- step 0 → 1 ---------------- */
  const analyze = () => {
    if (!s.jdText.trim()) {
      toast("Paste a job description first", "warn");
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      try {
        const parsed = parseJD(s.jdText);
        const match = scoreMatch(s.jdText, app.resume?.text ?? "");
        patch({ parsed, match, step: 1, selected: [], error: "", generated: null, tracking: "idle", googleStatus: "" });
        toast(`Parsed JD — ${match.matched.length + match.missing.length} keywords found`, "info");
      } catch (e) {
        patch({ error: e instanceof Error ? e.message : "Could not parse the JD" });
      }
      setBusy(false);
    }, 550);
  };

  /* ---------------- step 2 → 3 ---------------- */
  const generate = async () => {
    if (!app.resume || !s.parsed) return;
    setGenBusy(true);
    patch({ error: "" });
    let i = 0;
    setGenMsg(GEN_MSGS[0]);
    msgTimer.current = window.setInterval(() => {
      i = (i + 1) % GEN_MSGS.length;
      setGenMsg(GEN_MSGS[i]);
    }, 950);
    try {
      const generated = await generateTailored({
        profile: app.profile,
        resume: app.resume,
        jdText: s.jdText,
        parsed: s.parsed,
        keywords: s.selected,
      });
      patch({ generated, step: 3, error: "" });
      setTab("resume");
      toast("Tailored resume + cover letter ready", "ok");
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : "Generation failed" });
      toast("Generation failed — see details below", "err");
    } finally {
      if (msgTimer.current) window.clearInterval(msgTimer.current);
      setGenBusy(false);
    }
  };

  /* ---------------- step 3: export & track ---------------- */
  const company = s.parsed?.company || "Company";
  const baseName = sanitizeName(`${company}_${s.parsed?.role || "Role"}`);

  const downloadResume = () => {
    if (!s.generated) return;
    renderResumePDF(s.generated.resume).save(`${baseName}_Resume.pdf`);
    toast("Resume PDF downloaded", "ok");
  };
  const downloadCover = () => {
    if (!s.generated) return;
    renderCoverPDF(s.generated.coverLetter, s.generated.resume.contact.name).save(`${baseName}_CoverLetter.pdf`);
    toast("Cover letter PDF downloaded", "ok");
  };
  const downloadTex = () => {
    if (!s.generated) return;
    downloadBlob(new Blob([s.generated.latex], { type: "application/x-tex" }), `${baseName}_Resume.tex`);
    toast("LaTeX source downloaded", "ok");
  };

  const addToTracker = async () => {
    if (!s.parsed || !s.match) return;
    patch({ tracking: "working", googleStatus: "Appending row to tracker…" });
    const appRow: Application = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: todayISO(),
      company: s.parsed.company,
      role: s.parsed.role,
      link: "",
      location: s.parsed.location,
      match: s.match.score,
      workMode: s.parsed.workMode,
      salary: s.parsed.salary,
      posted: s.parsed.posted,
      applicants: s.parsed.applicants,
      visa: s.parsed.visa.status === "unknown" ? "" : s.parsed.visa.note,
      email: s.parsed.email,
      hasDocs: !!s.generated,
    };
    app.addApplication(appRow);

    const lines: string[] = [`Tracker row added locally ✓`];
    const cfg = app.profile;
    if (cfg.oauthClientId.trim() && (cfg.sheetId.trim() || cfg.driveFolderId.trim())) {
      try {
        lines.push("Requesting Google token…");
        patch({ googleStatus: lines.join("\n") });
        const token = await getGoogleToken(cfg.oauthClientId.trim());
        if (cfg.sheetId.trim()) {
          try {
            const row = [
              appRow.date, appRow.company, appRow.role, appRow.link, appRow.location,
              `${appRow.match}%`, appRow.workMode, appRow.salary, appRow.posted,
              appRow.applicants, appRow.visa, appRow.email,
            ];
            await appendTrackerRow(token, cfg.sheetId.trim(), row);
            lines.push(`Google Sheet — row appended ✓`);
          } catch (e) {
            lines.push(`Google Sheet — ${e instanceof Error ? e.message : "failed"}`);
          }
        }
        if (cfg.driveFolderId.trim() && s.generated) {
          try {
            const resumeBlob = renderResumePDF(s.generated.resume).output("blob");
            const coverBlob = renderCoverPDF(s.generated.coverLetter, s.generated.resume.contact.name).output("blob");
            await uploadToDrive(token, cfg.driveFolderId.trim(), `${baseName}_Resume.pdf`, resumeBlob);
            lines.push(`Drive — resume PDF uploaded ✓`);
            patch({ googleStatus: lines.join("\n") });
            await uploadToDrive(token, cfg.driveFolderId.trim(), `${baseName}_CoverLetter.pdf`, coverBlob);
            lines.push(`Drive — cover letter PDF uploaded ✓`);
          } catch (e) {
            lines.push(`Drive — ${e instanceof Error ? e.message : "failed"}`);
          }
        } else if (!cfg.driveFolderId.trim()) {
          lines.push("Drive folder not set — uploads skipped");
        }
      } catch (e) {
        lines.push(`Google — ${e instanceof Error ? e.message : "auth failed"}`);
      }
    } else {
      lines.push("Google not connected — Sheet/Drive skipped (set up in Profile)");
    }
    patch({ tracking: "done", googleStatus: lines.join("\n") });
    toast("Application added to tracker", "ok");
  };

  /* ---------------- renders ---------------- */

  const header = (
    <div className="mb-7">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="label-mono !text-moss">tailoring bench</span>
            <span className="h-1.5 w-1.5 rounded-full bg-moss dot-live" />
          </div>
          <h1 className="font-display font-bold text-[34px] leading-[1.05] tracking-tight">
            Strike a match on<br className="hidden md:block" /> your next application.
          </h1>
        </div>
        <div className="panel px-4 py-3 flex items-center gap-3">
          <IconDoc size={20} className={app.resume ? "text-moss" : "text-amber"} />
          <div>
            <div className="label-mono">master resume</div>
            <div className="text-[13px] font-semibold">
              {app.resume ? (
                <span className="text-moss">{app.resume.fileName}</span>
              ) : (
                <button onClick={goProfile} className="text-amber underline underline-offset-2 hover:text-ink transition-colors">
                  not uploaded — open Profile
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-7 panel px-5 py-4">
        <Stepper current={s.step} onJump={(i) => i < s.step && patch({ step: i as typeof s.step, error: "" })} />
      </div>
    </div>
  );

  /* STEP 0 — paste JD */
  if (s.step === 0) {
    return (
      <div className="anim-fade-up">
        {header}
        {!app.resume && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-[rgba(160,107,8,0.4)] bg-amberlight px-4 py-3">
            <IconAlert size={18} className="text-amber mt-0.5 shrink-0" />
            <p className="text-[13px] text-[#6d4c07]">
              Upload your <strong>master resume (PDF or .tex)</strong> in Profile first — the match score and
              tailoring both run against it. You can paste a JD now and score it later.
            </p>
          </div>
        )}
        <div className="panel p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h2 className="font-display font-bold text-xl">Paste the job description</h2>
              <p className="text-[13px] text-ink2 mt-0.5">
                Copy the full posting — title, responsibilities, requirements, and the fine print. Fields not in the text stay blank.
              </p>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                patch({ jdText: SAMPLE_JD, error: "" });
                toast("Sample JD loaded — hit Analyze", "info");
              }}
            >
              <IconSpark size={14} /> Load sample JD
            </button>
          </div>
          <textarea
            className="textarea font-mono !text-[12.5px] min-h-[300px]"
            placeholder={"Senior Frontend Engineer\nAcme Corp — Remote (US)\n\nAbout the role…\n- 5+ years with React, TypeScript…"}
            value={s.jdText}
            onChange={(e) => patch({ jdText: e.target.value })}
            spellCheck={false}
          />
          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <span className="font-mono text-[11px] text-ink3">
              {s.jdText.length.toLocaleString()} chars · parsed locally, nothing leaves this machine yet
            </span>
            <button className="btn btn-primary !h-11 !px-6" onClick={analyze} disabled={busy}>
              {busy ? <IconSpinner size={16} /> : <IconScan size={16} />}
              {busy ? "Scanning…" : "Analyze JD & run ATS match"}
            </button>
          </div>
          {s.error && <ErrorNote msg={s.error} />}
        </div>
      </div>
    );
  }

  /* STEP 1 — review extraction + match */
  if (s.step === 1 && s.parsed && s.match) {
    const p = s.parsed;
    const visaValue =
      p.visa.status === "unknown" ? (
        ""
      ) : (
        <span
          className={`chip chip-static chip-ink ${
            p.visa.status === "yes" ? "chip-moss" : p.visa.status === "no" ? "chip-coral" : "chip-amber"
          }`}
        >
          {p.visa.status === "yes" ? "Yes" : p.visa.status === "no" ? "No" : "Constraint"} · {p.visa.note}
        </span>
      );
    return (
      <div className="anim-fade-up">
        {header}
        <div className="grid lg:grid-cols-[300px_1fr] gap-5">
          <div className="panel p-6 flex flex-col items-center justify-center text-center">
            <ScoreRing score={s.match.score} />
            <p className="mt-3 text-[13.5px] font-semibold" style={{ color: s.match.score >= 70 ? "#106b45" : s.match.score >= 45 ? "#a06b08" : "#cf4423" }}>
              {bandLabel(s.match.score)}
            </p>
            <p className="text-[12px] text-ink3 mt-1 leading-relaxed">
              {s.match.matched.length} of {s.match.matched.length + s.match.missing.length} JD keywords
              found in your master resume
              {!app.resume && " — upload a resume to get real scoring"}.
            </p>
          </div>

          <div className="panel p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display font-bold text-xl">Extracted from the JD</h2>
              <span className="label-mono">auto-parsed · never guessed</span>
            </div>
            <Docket
              rows={[
                { label: "Company", value: p.company },
                { label: "Role", value: p.role },
                { label: "Location", value: p.location },
                { label: "Work mode", value: p.workMode },
                { label: "Salary", value: p.salary },
                { label: "Visa sponsor", value: visaValue },
                { label: "Posted", value: p.posted },
                { label: "Applicants", value: p.applicants },
                { label: "Contact email", value: p.email ? <span className="font-mono text-[12.5px]">{p.email}</span> : "" },
              ]}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mt-5">
          <div className="panel p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-moss" />
              <h3 className="font-display font-bold text-[15px]">Matched keywords ({s.match.matched.length})</h3>
            </div>
            {s.match.matched.length ? (
              <div className="flex flex-wrap gap-2 stagger">
                {s.match.matched.map((k) => (
                  <span key={k.term} className="chip chip-static chip-moss">
                    <IconCheck size={12} strokeWidth={2.4} /> {k.term}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink3 italic">No JD keywords matched your resume.</p>
            )}
          </div>
          <div className="panel p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-coral" />
              <h3 className="font-display font-bold text-[15px]">Missing keywords ({s.match.missing.length})</h3>
            </div>
            {s.match.missing.length ? (
              <div className="flex flex-wrap gap-2 stagger">
                {s.match.missing.map((k) => (
                  <span key={k.term} className="chip chip-static chip-coral">
                    {k.term}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink3 italic">Nothing missing — full coverage.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
          <button className="btn btn-outline" onClick={() => patch({ step: 0 })}>
            <IconArrowL size={15} /> Edit JD
          </button>
          <button className="btn btn-moss !h-11 !px-6" onClick={() => patch({ step: 2, error: "" })}>
            <IconFlame size={16} /> Tailor my resume for this role
            <IconArrowR size={15} />
          </button>
        </div>
      </div>
    );
  }

  /* STEP 2 — keyword selection + generation */
  if (s.step === 2 && s.parsed && s.match) {
    const missingTerms = s.match.missing.map((m) => m.term);
    const toggle = (term: string) => {
      patch({
        selected: s.selected.includes(term) ? s.selected.filter((t) => t !== term) : [...s.selected, term],
      });
    };
    const ready = !!app.resume && !!app.profile.apiKey.trim() && !genBusy;
    return (
      <div className="anim-fade-up">
        {header}
        <div className="panel p-6">
          <h2 className="font-display font-bold text-xl">Which missing keywords should the rewrite emphasize?</h2>
          <p className="text-[13px] text-ink2 mt-1 max-w-2xl leading-relaxed">
            Only the keywords you select are passed to the model — and the model is instructed to weave them in{" "}
            <em>only where your existing experience truthfully supports them</em>. Nothing is invented.
          </p>

          <div className="mt-5">
            <div className="label-mono mb-2.5">suggested from the JD ({missingTerms.length})</div>
            {missingTerms.length ? (
              <div className="flex flex-wrap gap-2 stagger">
                {missingTerms.map((t) => (
                  <button key={t} className={`chip ${s.selected.includes(t) ? "chip-on" : ""}`} onClick={() => toggle(t)}>
                    {s.selected.includes(t) ? <IconCheck size={12} strokeWidth={2.6} /> : <IconPlus size={12} />}
                    {t}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink3 italic">No missing keywords — your resume already covers everything the JD mentions.</p>
            )}
          </div>

          <div className="mt-5">
            <div className="label-mono mb-2.5">add your own (comma separated)</div>
            <input
              className="input max-w-xl"
              placeholder="e.g. stakeholder communication, design systems"
              value={s.customKw}
              onChange={(e) => patch({ customKw: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const bits = s.customKw.split(",").map((x) => x.trim()).filter(Boolean);
                  if (!bits.length) return;
                  const next = [...new Set([...s.selected, ...bits])];
                  patch({ selected: next, customKw: "" });
                }
              }}
            />
            <p className="text-[11.5px] text-ink3 mt-1.5">
              Press Enter to add · currently selected: <strong className="text-ink2">{s.selected.join(", ") || "none"}</strong>
            </p>
          </div>

          {!app.resume && (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-[rgba(207,68,35,0.35)] bg-corallight px-4 py-3">
              <IconAlert size={18} className="text-coral mt-0.5 shrink-0" />
              <p className="text-[13px] text-[#8c2f17]">
                A master resume is required for generation.{" "}
                <button className="underline font-semibold" onClick={goProfile}>Upload one in Profile</button>.
              </p>
            </div>
          )}
          {!app.profile.apiKey.trim() && (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-[rgba(207,68,35,0.35)] bg-corallight px-4 py-3">
              <IconAlert size={18} className="text-coral mt-0.5 shrink-0" />
              <p className="text-[13px] text-[#8c2f17]">
                No LLM API key configured — generation calls the provider you choose (OpenAI, Gemini, or OpenRouter).{" "}
                <button className="underline font-semibold" onClick={goProfile}>Add a key in Profile</button>.
              </p>
            </div>
          )}

          {genBusy && (
            <div className="mt-6 rounded-lg border border-line bg-white/70 px-5 py-4 flex items-center gap-4">
              <IconSpinner size={20} className="text-moss" />
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold">{genMsg}</div>
                <div className="h-1.5 mt-2 rounded-full overflow-hidden shimmer" />
              </div>
              <span className="font-mono text-[11px] text-ink3">{app.profile.provider}/{app.profile.model || "default"}</span>
            </div>
          )}
          {s.error && <ErrorNote msg={s.error} />}

          <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
            <button className="btn btn-outline" onClick={() => patch({ step: 1 })} disabled={genBusy}>
              <IconArrowL size={15} /> Back to match review
            </button>
            <button className="btn btn-primary !h-11 !px-6" onClick={generate} disabled={!ready}>
              {genBusy ? <IconSpinner size={16} /> : <IconFlame size={16} />}
              {genBusy ? "Generating…" : "Generate tailored resume + cover letter"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* STEP 3 — export & track */
  if (s.step === 3 && s.generated && s.parsed) {
    const g = s.generated;
    return (
      <div className="anim-fade-up">
        {header}
        <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
          <div className="panel p-5">
            <div className="flex items-center gap-1 mb-4 border-b border-linesoft">
              {(["resume", "cover", "latex"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-[13px] font-semibold rounded-t-md border-b-2 -mb-px transition-all ${
                    tab === t ? "border-moss text-ink bg-white" : "border-transparent text-ink3 hover:text-ink"
                  }`}
                >
                  {t === "resume" ? "Tailored resume" : t === "cover" ? "Cover letter" : "LaTeX source"}
                </button>
              ))}
            </div>

            {tab === "resume" && (
              <div className="paper-doc anim-pop mx-auto max-w-[640px] px-10 py-9">
                <div className="text-center">
                  <div className="font-display font-bold text-[22px]">{g.resume.contact.name || "Your Name"}</div>
                  <div className="text-[11.5px] text-ink2 mt-1">
                    {[g.resume.contact.email, g.resume.contact.phone, g.resume.contact.location].filter(Boolean).join("  ·  ")}
                  </div>
                  {g.resume.roleTitle && <div className="mt-2 text-[13px] font-bold">{g.resume.roleTitle}</div>}
                </div>
                <DocSection title="Summary"><p className="text-[12.5px] leading-relaxed">{g.resume.summary}</p></DocSection>
                <DocSection title="Skills"><p className="text-[12.5px] leading-relaxed">{g.resume.skillsLine}</p></DocSection>
                <DocSection title="Experience">
                  {g.resume.experience.map((e, i) => (
                    <div key={i} className="mb-3.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-bold">{e.title}</span>
                        <span className="text-[11px] text-ink2 font-mono shrink-0">{e.dates}</span>
                      </div>
                      {e.company && <div className="text-[12px] italic">{e.company}</div>}
                      <ul className="mt-1 space-y-0.5">
                        {e.bullets.map((b, j) => (
                          <li key={j} className="text-[12.5px] leading-relaxed pl-4 relative">
                            <span className="absolute left-0 text-ink3">•</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </DocSection>
                {g.resume.education.length > 0 && (
                  <DocSection title="Education">
                    {g.resume.education.map((ed, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-3 mb-1">
                        <div>
                          <span className="text-[12.5px] font-bold">{ed.degree}</span>
                          {ed.school && <span className="text-[12px] italic text-ink2"> — {ed.school}</span>}
                        </div>
                        <span className="text-[11px] text-ink2 font-mono">{ed.dates}</span>
                      </div>
                    ))}
                  </DocSection>
                )}
              </div>
            )}

            {tab === "cover" && (
              <div className="paper-doc anim-pop mx-auto max-w-[640px] px-10 py-9">
                <div className="font-display font-bold text-[16px]">{g.resume.contact.name || "Cover letter"}</div>
                <div className="text-[11px] text-ink2 mt-1">
                  {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </div>
                <hr className="my-4 border-linesoft" />
                {g.coverLetter.split(/\n+/).map((p, i) => (
                  <p key={i} className="text-[12.5px] leading-relaxed mb-3 whitespace-pre-wrap">{p}</p>
                ))}
              </div>
            )}

            {tab === "latex" && (
              <pre className="code-block anim-pop max-h-[520px] overflow-auto scroll-thin">{g.latex}</pre>
            )}

            <div className="flex flex-wrap gap-2.5 mt-5">
              <button className="btn btn-primary" onClick={downloadResume}><IconDownload size={15} /> Resume PDF</button>
              <button className="btn btn-outline" onClick={downloadCover}><IconDownload size={15} /> Cover letter PDF</button>
              <button className="btn btn-outline" onClick={downloadTex}><IconDownload size={15} /> LaTeX source (.tex)</button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="panel p-5">
              <h3 className="font-display font-bold text-[16px] flex items-center gap-2">
                <IconTable size={17} className="text-moss" /> Add to application tracker?
              </h3>
              <p className="text-[12.5px] text-ink2 mt-1.5 leading-relaxed">
                Saves a row (date, company, role, match…) to your local tracker. The Link column stays empty — fill it in from the Tracker page.
              </p>
              <div className="mt-3 rounded-lg border border-linesoft bg-white/70 px-3 py-2.5 font-mono text-[11px] text-ink2 leading-relaxed">
                {todayISO()} · {s.parsed.company || "—"} · {s.parsed.role || "—"} · {s.match?.score ?? 0}%
              </div>
              {s.tracking === "idle" && (
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-moss flex-1" onClick={addToTracker}>
                    <IconCheck size={15} strokeWidth={2.4} /> Yes, add it
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      patch({ tracking: "skipped" });
                      toast("Skipped — nothing was added", "info");
                    }}
                  >
                    Skip
                  </button>
                </div>
              )}
              {s.tracking === "working" && (
                <div className="mt-4 flex items-center gap-2.5 text-[13px] font-semibold text-moss">
                  <IconSpinner size={16} /> Saving & archiving…
                </div>
              )}
              {s.googleStatus && (
                <pre className="mt-4 rounded-lg bg-night text-[#c9cfc2] font-mono text-[11px] leading-relaxed px-3.5 py-3 whitespace-pre-wrap">
                  {s.googleStatus}
                </pre>
              )}
              {s.tracking === "done" && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-moss text-[13.5px] font-bold">
                    <IconCheck size={16} strokeWidth={2.6} /> Saved to tracker
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm flex-1" onClick={goTracker}>
                      Open tracker <IconArrowR size={13} />
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => app.resetSession()}>
                      Tailor another
                    </button>
                  </div>
                </div>
              )}
              {s.tracking === "skipped" && (
                <button className="btn btn-outline btn-sm mt-4" onClick={() => app.resetSession()}>
                  Tailor another role
                </button>
              )}
            </div>

            <div className="panel p-5">
              <h4 className="label-mono mb-2">honesty guard</h4>
              <p className="text-[12.5px] text-ink2 leading-relaxed">
                Employers, titles, dates, and education were carried over verbatim from your master resume. The model was
                instructed to rewrite phrasing only — never to invent skills, numbers, or achievements.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h4 className="font-display font-bold text-[13px] uppercase tracking-wide">{title}</h4>
      <div className="h-px bg-line mt-1 mb-2.5" />
      {children}
    </section>
  );
}

function ErrorNote({ msg }: { msg: string }) {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-lg border border-[rgba(207,68,35,0.35)] bg-corallight px-4 py-3 anim-pop">
      <IconAlert size={18} className="text-coral mt-0.5 shrink-0" />
      <div>
        <div className="text-[13px] font-bold text-[#8c2f17]">Something went wrong</div>
        <div className="text-[12.5px] text-[#8c2f17]/90 mt-0.5 leading-relaxed">{msg}</div>
      </div>
    </div>
  );
}
