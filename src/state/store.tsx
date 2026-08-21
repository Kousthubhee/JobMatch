import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { idbDel, idbGet, idbSet } from "../lib/db";
import {
  DEFAULT_PROFILE, DEFAULT_SESSION,
  type Application, type MasterResume, type Profile, type Session,
} from "../lib/types";

/**
 * App state, persisted to IndexedDB on every change and hydrated on load.
 * Restart the dev server, reboot the machine — everything is still here.
 */

interface AppState {
  ready: boolean;
  profile: Profile;
  resume: MasterResume | null;
  applications: Application[];
  session: Session;
}

interface Actions {
  patchProfile: (p: Partial<Profile>) => void;
  setResume: (r: MasterResume | null) => void;
  addApplication: (a: Application) => void;
  updateApplication: (id: string, patch: Partial<Application>) => void;
  deleteApplication: (id: string) => void;
  setSession: (s: Session | ((prev: Session) => Session)) => void;
  resetSession: () => void;
}

const Ctx = createContext<(AppState & Actions) | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    ready: false,
    profile: DEFAULT_PROFILE,
    resume: null,
    applications: [],
    session: DEFAULT_SESSION,
  });

  const persist = useCallback((key: string, value: unknown) => {
    if (value === null || value === undefined) void idbDel(key);
    else void idbSet(key, value);
  }, []);

  const hydrate = useCallback(async () => {
    const [profile, resume, applications, session] = await Promise.all([
      idbGet<Profile>("profile"),
      idbGet<MasterResume>("resume"),
      idbGet<Application[]>("applications"),
      idbGet<Session>("session"),
    ]);
    setState({
      ready: true,
      profile: { ...DEFAULT_PROFILE, ...(profile ?? {}) },
      resume: resume ?? null,
      applications: applications ?? [],
      session: { ...DEFAULT_SESSION, ...(session ?? {}) },
    });
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const actions: Actions = {
    patchProfile: (p) => {
      setState((s) => {
        const next = { ...s.profile, ...p };
        persist("profile", next);
        return { ...s, profile: next };
      });
    },
    setResume: (r) => {
      persist("resume", r);
      setState((s) => ({ ...s, resume: r }));
    },
    addApplication: (a) => {
      setState((s) => {
        const next = [a, ...s.applications];
        persist("applications", next);
        return { ...s, applications: next };
      });
    },
    updateApplication: (id, patch) => {
      setState((s) => {
        const next = s.applications.map((a) => (a.id === id ? { ...a, ...patch } : a));
        persist("applications", next);
        return { ...s, applications: next };
      });
    },
    deleteApplication: (id) => {
      setState((s) => {
        const next = s.applications.filter((a) => a.id !== id);
        persist("applications", next);
        return { ...s, applications: next };
      });
    },
    setSession: (sess) => {
      // functional updates merge into the latest persisted session so
      // rapid async changes (tracker save, google archive) never clobber each other
      setState((s) => {
        const next = typeof sess === "function" ? sess(s.session) : sess;
        persist("session", next);
        return { ...s, session: next };
      });
    },
    resetSession: () => {
      persist("session", DEFAULT_SESSION);
      setState((s) => ({ ...s, session: DEFAULT_SESSION }));
    },
  };

  return <Ctx.Provider value={{ ...state, ...actions }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
