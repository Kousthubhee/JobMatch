import React, { useMemo, useState } from "react";
import { useApp } from "../state/store";
import type { Application } from "../lib/types";
import { downloadBlob } from "../lib/pdf";
import { toast } from "../components/ui";
import { IconAlert, IconCheck, IconFlame, IconLink, IconMail, IconPlus, IconTarget, IconTrash } from "../components/icons";

const CSV_HEADERS = ["Date", "Company", "Role", "Link", "Location", "Match %", "Work Mode", "Salary", "Posted", "Applicants", "Visa Sponsorship", "Email"];

function escCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export default function TrackerView({ goTailor }: { goTailor: () => void }) {
  const app = useApp();
  const [query, setQuery] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return app.applications;
    return app.applications.filter((a) =>
      [a.company, a.role, a.location, a.workMode, a.email, a.link].some((f) => f.toLowerCase().includes(q))
    );
  }, [app.applications, query]);

  const stats = useMemo(() => {
    const all = app.applications;
    const avg = all.length ? Math.round(all.reduce((s, a) => s + a.match, 0) / all.length) : 0;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const recent = all.filter((a) => new Date(a.date).getTime() >= weekStart.getTime()).length;
    const strong = all.filter((a) => a.match >= 70).length;
    return { total: all.length, avg, recent, strong };
  }, [app.applications]);

  const exportCsv = () => {
    const lines = [
      CSV_HEADERS.join(","),
      ...rows.map((a) =>
        [a.date, a.company, a.role, a.link, a.location, `${a.match}%`, a.workMode, a.salary, a.posted, a.applicants, a.visa, a.email]
          .map(escCsv)
          .join(",")
      ),
    ].join("\n");
    downloadBlob(new Blob([lines], { type: "text/csv" }), "matchbook_tracker.csv");
    toast("Tracker exported as CSV", "ok");
  };

  const setLink = (a: Application, link: string) => app.updateApplication(a.id, { link });

  const remove = (id: string) => {
    if (confirmDel !== id) {
      setConfirmDel(id);
      window.setTimeout(() => setConfirmDel((c) => (c === id ? null : c)), 2600);
      return;
    }
    app.deleteApplication(id);
    setConfirmDel(null);
    toast("Application removed", "info");
  };

  return (
    <div className="anim-fade-up">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
        <div>
          <div className="label-mono !text-moss mb-2">application ledger</div>
          <h1 className="font-display font-bold text-[34px] leading-[1.05] tracking-tight">
            Every strike, on record.
          </h1>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={exportCsv} disabled={!rows.length}>
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={goTailor}>
            <IconFlame size={15} /> Tailor a new one
          </button>
        </div>
      </div>

      {/* stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
        <Stat label="applications" value={String(stats.total)} icon={<IconTarget size={17} />} />
        <Stat label="avg match" value={`${stats.avg}%`} icon={<IconCheck size={17} />} tone={stats.avg >= 55 ? "moss" : "amber"} />
        <Stat label="last 7 days" value={String(stats.recent)} icon={<IconPlus size={17} />} />
        <Stat label="strong (70%+)" value={String(stats.strong)} icon={<IconFlame size={17} />} tone="moss" />
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-3.5 border-b border-line">
          <div className="relative">
            <input
              className="input !h-9 !w-[260px] !pl-9 !text-[12.5px]"
              placeholder="Filter by company, role, location…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-mono text-[11px] text-ink3">
            {rows.length} of {app.applications.length} rows · stored in IndexedDB
          </span>
        </div>

        {app.applications.length === 0 ? (
          <EmptyState goTailor={goTailor} />
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <IconAlert size={26} className="text-ink3 mx-auto mb-3" />
            <p className="text-[13.5px] text-ink3">No rows match “{query}”.</p>
            <button className="btn btn-outline btn-sm mt-3" onClick={() => setQuery("")}>Clear filter</button>
          </div>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="tbl w-full">
              <thead>
                <tr>
                  <th>Date</th><th>Company</th><th>Role</th><th>Link</th><th>Location</th>
                  <th>Match</th><th>Mode</th><th>Salary</th><th>Posted</th><th>Applicants</th>
                  <th>Visa</th><th>Email</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono text-[12px] text-ink2">{a.date}</td>
                    <td className="font-semibold">{a.company || "—"}</td>
                    <td className="max-w-[190px] truncate" title={a.role}>{a.role || "—"}</td>
                    <td>
                      <LinkCell value={a.link} onSave={(v) => setLink(a, v)} />
                    </td>
                    <td className="text-ink2">{a.location || "—"}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold ${a.match >= 70 ? "text-moss" : a.match >= 45 ? "text-amber" : "text-coral"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${a.match >= 70 ? "bg-moss" : a.match >= 45 ? "bg-amber" : "bg-coral"}`} />
                        {a.match}%
                      </span>
                    </td>
                    <td className="text-ink2">{a.workMode || "—"}</td>
                    <td className="text-ink2 max-w-[130px] truncate" title={a.salary}>{a.salary || "—"}</td>
                    <td className="text-ink2">{a.posted || "—"}</td>
                    <td className="text-ink2">{a.applicants || "—"}</td>
                    <td className="text-ink2 max-w-[160px] truncate" title={a.visa}>{a.visa || "—"}</td>
                    <td>
                      {a.email ? (
                        <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1.5 text-moss hover:text-mossdeep transition-colors" title={a.email}>
                          <IconMail size={14} /> send
                        </a>
                      ) : (
                        <span className="text-ink3">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm transition-all ${confirmDel === a.id ? "btn-danger" : "btn-outline !border-transparent text-ink3 hover:!text-coral hover:!bg-corallight"}`}
                        onClick={() => remove(a.id)}
                        title="Delete row"
                      >
                        {confirmDel === a.id ? "Sure?" : <IconTrash size={14} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11.5px] text-ink3 mt-3 font-mono">
        Tip: the Link column is intentionally empty when a row is added — paste the posting URL here.
      </p>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: "moss" | "amber" }) {
  return (
    <div className="panel px-5 py-4 flex items-center gap-4">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-transform duration-200 hover:scale-105 ${tone === "moss" ? "text-moss border-[rgba(16,107,69,0.35)] bg-mosslight" : tone === "amber" ? "text-amber border-[rgba(160,107,8,0.35)] bg-amberlight" : "text-ink2 border-line bg-white/70"}`}>
        {icon}
      </span>
      <div>
        <div className="font-display font-bold text-[24px] leading-none tracking-tight">{value}</div>
        <div className="label-mono mt-1.5">{label}</div>
      </div>
    </div>
  );
}

function LinkCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return value ? (
      <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-moss hover:text-mossdeep transition-colors max-w-[150px]">
        <IconLink size={13} />
        <span className="truncate font-mono text-[11.5px]">{value.replace(/^https?:\/\/(www\.)?/, "").slice(0, 22)}…</span>
      </a>
    ) : (
      <button className="text-ink3 hover:text-ink transition-colors font-mono text-[11px] inline-flex items-center gap-1" onClick={() => { setDraft(""); setEditing(true); }}>
        <IconPlus size={11} /> add link
      </button>
    );
  }
  return (
    <input
      autoFocus
      className="input !h-7 !w-[170px] !text-[11.5px] !px-2 font-mono"
      value={draft}
      placeholder="https://…"
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { onSave(draft.trim()); setEditing(false); }
        if (e.key === "Escape") setEditing(false);
      }}
      onBlur={() => { onSave(draft.trim()); setEditing(false); }}
    />
  );
}

function EmptyState({ goTailor }: { goTailor: () => void }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-line bg-white/60">
        <IconTarget size={24} className="text-ink3" />
      </div>
      <h3 className="font-display font-bold text-lg">No applications tracked yet</h3>
      <p className="text-[13px] text-ink2 mt-1 max-w-sm mx-auto leading-relaxed">
        Tailor a resume for a job posting, then confirm the tracker row — it lands here with the match score and every parsed JD field.
      </p>
      <button className="btn btn-moss mt-5" onClick={goTailor}>
        <IconFlame size={15} /> Tailor your first resume
      </button>
    </div>
  );
}
