/**
 * Google Sheets + Drive integration via Google Identity Services (OAuth 2.0
 * implicit flow, fully client-side — the right fit for a local single-user
 * tool; no service-account key files to babysit).
 *
 * Scopes:
 *  - spreadsheets   → append tracker rows to the user's sheet
 *  - drive          → upload generated PDFs into the user's chosen folder
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
            error_callback?: (err: unknown) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export const GOOGLE_SCOPES =
  "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";

const TOKEN_KEY = "matchbook.googleToken";
let gisPromise: Promise<void> | null = null;

export function loadGIS(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error("Could not load the Google Identity script (offline?)."));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

export async function getGoogleToken(clientId: string, force = false): Promise<string> {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "null");
      if (cached?.access_token && cached.expiresAt > Date.now() + 60_000) return cached.access_token;
    } catch {
      /* fall through to fresh token */
    }
  }
  await loadGIS();
  return new Promise((resolve, reject) => {
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_SCOPES,
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            reject(new Error(`Google sign-in failed: ${resp.error ?? "no token returned"}`));
            return;
          }
          localStorage.setItem(
            TOKEN_KEY,
            JSON.stringify({ access_token: resp.access_token, expiresAt: Date.now() + (resp.expires_in ?? 3500) * 1000 })
          );
          resolve(resp.access_token);
        },
        error_callback: (err) => reject(new Error(`Google sign-in error: ${String((err as { message?: string })?.message ?? err)}`)),
      });
      client.requestAccessToken();
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

async function gFetch(url: string, token: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const b = await res.json();
      detail = b?.error?.message ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(`Google API ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function testSheetConnection(token: string, sheetId: string): Promise<string> {
  const data = (await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=properties.title`,
    token
  )) as { properties?: { title?: string } };
  return data?.properties?.title ?? "connected";
}

export async function testDriveConnection(token: string, folderId: string): Promise<string> {
  const data = (await gFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=name,mimeType`,
    token
  )) as { name?: string };
  return data?.name ?? "connected";
}

/** Appends a row after the existing data in the first tab of the sheet. */
export async function appendTrackerRow(token: string, sheetId: string, row: string[]): Promise<void> {
  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    token,
    { method: "POST", body: JSON.stringify({ values: [row] }) }
  );
}

export async function uploadToDrive(
  token: string,
  folderId: string,
  fileName: string,
  blob: Blob
): Promise<void> {
  const meta = { name: fileName, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", blob, fileName);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const b = await res.json();
      detail = b?.error?.message ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(`Drive upload ${res.status}${detail ? `: ${detail}` : ""}`);
  }
}

export const SHEET_HEADER = [
  "Date", "Company", "Role", "Link", "Location", "Match %", "Work Mode",
  "Salary", "Posted", "Applicants", "Visa Sponsorship", "Email",
];
