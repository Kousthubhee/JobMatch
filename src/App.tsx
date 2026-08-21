import React, { Component, useEffect, useState } from "react";
import { AppProvider, useApp } from "./state/store";
import { ToastHost } from "./components/ui";
import TailorView from "./views/TailorView";
import TrackerView from "./views/TrackerView";
import ProfileView from "./views/ProfileView";
import GuideView from "./views/GuideView";
import {
  IconAlert, IconBook, IconFlame, IconRefresh, IconSliders, IconTable, LogoMark,
} from "./components/icons";

type View = "tailor" | "tracker" | "profile" | "guide";

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="panel max-w-lg p-8 text-center">
            <IconAlert size={30} className="text-coral mx-auto mb-4" />
            <h1 className="font-display font-bold text-xl mb-2">Matchbook hit a snag</h1>
            <p className="text-[13px] text-ink2 leading-relaxed mb-3">
              A runtime error occurred. Your data (resume, tracker, settings) is safe in IndexedDB — a reload should restore everything.
            </p>
            <pre className="code-block text-left mb-5 max-h-40 overflow-auto scroll-thin">{this.state.error.message}</pre>
            <button className="btn btn-primary" onClick={() => { this.setState({ error: null }); window.location.reload(); }}>
              <IconRefresh size={15} /> Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Shell() {
  const app = useApp();
  const [view, setView] = useState<View>(() => (localStorage.getItem("matchbook.view") as View) || "tailor");

  useEffect(() => {
    localStorage.setItem("matchbook.view", view);
  }, [view]);

  if (!app.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <LogoMark size={44} />
          <div className="label-mono">opening local database…</div>
        </div>
      </div>
    );
  }

  const nav: { id: View; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "tailor", label: "Tailor", icon: <IconFlame size={17} /> },
    { id: "tracker", label: "Tracker", icon: <IconTable size={17} />, badge: app.applications.length ? String(app.applications.length) : undefined },
    { id: "profile", label: "Profile", icon: <IconSliders size={17} /> },
    { id: "guide", label: "Setup Guide", icon: <IconBook size={17} /> },
  ];

  return (
    <div className="min-h-screen flex">
      {/* ---------- sidebar ---------- */}
      <aside className="w-[232px] shrink-0 bg-night text-bone flex flex-col sticky top-0 h-screen max-lg:w-[64px]">
        <div className="flex items-center gap-3 px-5 max-lg:px-0 max-lg:justify-center pt-6 pb-7">
          <LogoMark size={34} />
          <div className="max-lg:hidden">
            <div className="font-display font-bold text-[17px] tracking-tight leading-none">Matchbook</div>
            <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-[rgba(237,238,230,0.45)] mt-1.5">
              tailor · match · track
            </div>
          </div>
        </div>

        <nav className="px-3 max-lg:px-2.5 space-y-1.5 flex-1">
          {nav.map((n) => (
            <button key={n.id} className={`nav-item max-lg:justify-center max-lg:!px-0 ${view === n.id ? "active" : ""}`} onClick={() => setView(n.id)}>
              <span className="shrink-0">{n.icon}</span>
              <span className="max-lg:hidden flex-1 text-left">{n.label}</span>
              {n.badge && (
                <span className="max-lg:hidden font-mono text-[10.5px] bg-[rgba(46,164,108,0.18)] text-[#7fd0a4] border border-[rgba(46,164,108,0.35)] rounded-full px-2 py-0.5">
                  {n.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-4 max-lg:px-2 pb-5 space-y-2.5">
          <div className="max-lg:hidden rounded-lg border border-nightline bg-night2 px-3.5 py-3">
            <StatusRow ok={!!app.resume} label="master resume" detail={app.resume ? app.resume.fileName : "not uploaded"} onClick={() => setView("profile")} />
            <StatusRow ok={!!app.profile.apiKey.trim()} label="llm provider" detail={app.profile.apiKey ? app.profile.provider : "no key"} onClick={() => setView("profile")} />
            <StatusRow
              ok={!!app.profile.oauthClientId.trim() && (!!app.profile.sheetId.trim() || !!app.profile.driveFolderId.trim())}
              label="google"
              detail={app.profile.oauthClientId ? "ids set" : "not linked"}
              onClick={() => setView("profile")}
            />
          </div>
          <div className="font-mono text-[9.5px] text-[rgba(237,238,230,0.35)] leading-relaxed max-lg:hidden">
            local-first · IndexedDB<br />v1.0 · runs on localhost
          </div>
          <div className="lg:hidden flex justify-center">
            <span className={`h-2 w-2 rounded-full ${app.resume && app.profile.apiKey ? "bg-[#2ea46c]" : "bg-[#c98a12]"} dot-live`} />
          </div>
        </div>
      </aside>

      {/* ---------- content ---------- */}
      <main className="flex-1 min-w-0 px-6 sm:px-10 py-9 max-w-[1240px]">
        {view === "tailor" && <TailorView goProfile={() => setView("profile")} goTracker={() => setView("tracker")} />}
        {view === "tracker" && <TrackerView goTailor={() => setView("tailor")} />}
        {view === "profile" && <ProfileView goGuide={() => setView("guide")} />}
        {view === "guide" && <GuideView goProfile={() => setView("profile")} />}
      </main>

      <ToastHost />
    </div>
  );
}

function StatusRow({ ok, label, detail, onClick }: { ok: boolean; label: string; detail: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 py-1.5 text-left group">
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${ok ? "bg-[#2ea46c]" : "bg-[#c98a12]"} ${ok ? "" : "dot-live"}`} />
      <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-[rgba(237,238,230,0.5)] w-[86px] shrink-0">{label}</span>
      <span className="text-[11px] text-[rgba(237,238,230,0.8)] truncate group-hover:text-bone transition-colors">{detail}</span>
    </button>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ErrorBoundary>
  );
}
