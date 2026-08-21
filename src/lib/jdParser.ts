import type { ParsedJD, VisaInfo } from "./types";

/**
 * Deterministic JD field extraction. Heuristics only — when a field isn't
 * present in the text it stays blank. We never guess.
 */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function extractCompany(text: string): string {
  const lines = text.split(/\r?\n/).map(norm).filter(Boolean);

  const aboutLine = lines.find((l) => /^(about|who we are|the company|company)[:\-–—]\s+/i.test(l));
  if (aboutLine) {
    const rest = aboutLine.replace(/^(about|who we are|the company|company)[:\-–—]\s+/i, "");
    const bits = rest.split(/[.,;—–-]/);
    if (bits[0].trim().length <= 48) return bits[0].trim();
  }

  const labelLine = lines.find((l) => /^(company|employer|organization|organisation)[:\-–—]\s+\S/i.test(l));
  if (labelLine) return labelLine.replace(/^(company|employer|organization|organisation)[:\-–—]\s+/i, "").split(/[|·•]/)[0].trim().slice(0, 48);

  const atLine = lines.find((l) => /^.{2,40}\s+at\s+[A-Z][A-Za-z0-9&.' -]{1,38}$/.test(l));
  if (atLine) return (atLine.match(/\bat\s+(.+)$/)![1] || "").trim();

  const joinLine = lines.find((l) => /^(join|come build with|build with|help us at)\s+[A-Z][A-Za-z0-9&.' -]{1,38}[.!]?$/.test(l));
  if (joinLine) {
    return joinLine.replace(/^(join|come build with|build with|help us at)\s+/i, "").replace(/[.!]$/, "").trim();
  }

  const incLine = lines.find((l) =>
    /^(at\s+)?[A-Z][A-Za-z0-9&.' -]{1,38}(,?\s+(Inc\.?|LLC|Ltd\.?|GmbH|Corp\.?|Corporation|Labs?|Technologies|Technologies, Inc\.?))$/i.test(l)
  );
  if (incLine) return incLine.replace(/^at\s+/i, "").trim();

  return "";
}

function extractRole(text: string): string {
  const lines = text.split(/\r?\n/).map(norm).filter(Boolean);

  const labelLine = lines.find((l) => /^(role|position|job title|title|hiring)[:\-–—]\s+\S/i.test(l));
  if (labelLine) return labelLine.replace(/^(role|position|job title|title|hiring)[:\-–—]\s+/i, "").slice(0, 64);

  const kwRe = /\b((sr\.?|jr\.?|senior|junior|staff|principal|lead|entry[- ]level|founding)\s+)*(software|frontend|front[- ]end|backend|back[- ]end|full[- ]?stack|data|machine learning|ml|devops|site reliability|sre|platform|infrastructure|mobile|ios|android|product|ux|ui|growth|marketing|sales|solutions|security|research|applied|cloud|systems|embedded|quality|qa|technical|engineering|game|graphics)\s+(engineer(ing)?|developer|designer|scientist|analyst|manager|architect|specialist|consultant|director|lead|interviewer)\b/i;

  for (const l of lines.slice(0, 10)) {
    const m = l.match(kwRe);
    if (m && l.length <= 80) return l.replace(/\s*[|·•].*$/, "").trim();
  }
  for (const l of lines) {
    const m = l.match(kwRe);
    if (m) return (m[0] || "").trim().slice(0, 64);
  }

  const firstShort = lines.find((l) => l.length <= 64 && !/^[a-z]/.test(l) && !EMAIL_RE.test(l) && !/\d{5}/.test(l));
  return firstShort ? firstShort.slice(0, 64) : "";
}

function extractLocation(text: string, workMode: string): string {
  const label = text.match(/(?:^|\n)\s*(?:location|where|office|based in|work location)[:\-–—]\s*([^\n]+)/i);
  if (label) return norm(label[1] || "").split(/[|·•]/)[0].slice(0, 60);

  const cityRe =
    /\b(San Francisco|San Jose|New York|NYC|Seattle|Austin|Boston|Los Angeles|Chicago|Denver|Portland|Atlanta|Toronto|Vancouver|London|Berlin|Amsterdam|Paris|Dublin|Zurich|Bangalore|Bengaluru|Hyderabad|Pune|Mumbai|Delhi|Singapore|Sydney|Melbourne|Tel Aviv|Warsaw|Krak[oó]w|Madrid|Barcelona|Lisbon|Stockholm|Copenhagen|Helsinki|Oslo|Munich|Hamburg|Zurich|Dubai|Remote)\b/gi;
  const hits = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = cityRe.exec(text)) !== null) {
    const c = m[0] === "Remote" ? "Remote" : norm(m[0] || "");
    hits.set(c, (hits.get(c) ?? 0) + 1);
  }
  const ranked = [...hits.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const nonRemote = ranked.filter((c) => c !== "Remote");

  if (workMode.toLowerCase() === "remote" && !nonRemote.length) return "Remote";
  if (nonRemote.length) return nonRemote.slice(0, 2).join(", ");
  if (ranked.includes("Remote")) return "Remote";

  const inline = text.match(/\b(?:based in|located in|our office in|in our)\s+([A-Z][A-Za-z]+(?:,\s*[A-Z]{2})?)/);
  if (inline) return norm(inline[1] || "").slice(0, 60);
  return "";
}

function extractWorkMode(text: string): string {
  const t = text.toLowerCase();
  const remoteHits = (t.match(/\b(remote|work from home|wfh|distributed team|anywhere in)\b/g) ?? []).length;
  const onsiteHits = (t.match(/\b(on-?site|onsite|in[- ]office|in office|from our office|office-based|relocate|commute)\b/g) ?? []).length;
  const hybridHits = (t.match(/\b(hybrid)\b/g) ?? []).length;

  if (hybridHits > 0) return "Hybrid";
  if (remoteHits > onsiteHits) return "Remote";
  if (onsiteHits > 0) return "On-site";
  if (remoteHits > 0) return "Remote";
  return "";
}

function extractSalary(text: string): string {
  const re =
    /\$\s?\d{2,3}(?:[.,]\d+)?\s?k?\s?(?:–|-|to|—)\s?\$?\s?\d{2,3}(?:[.,]\d+)?\s?k?\b|\$\s?\d{2,3},?\d{3}(?:\.\d+)?\s?(?:–|-|to|—)\s?\$?\s?\d{2,3},?\d{3}(?:\.\d+)?|£\s?\d{2,3}(?:[.,]\d+)?\s?k?\s?(?:–|-|to)\s?£?\s?\d{2,3}(?:[.,]\d+)?\s?k?|€\s?\d{2,3}(?:[.,]\d+)?\s?k?\s?(?:–|-|to)\s?€?\s?\d{2,3}(?:[.,]\d+)?\s?k?/i;
  const m = text.match(re);
  if (!m) return "";
  const raw = norm(m[0] || "");
  const near = text.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + raw.length + 40).toLowerCase();
  if (!/\b(hour|hourly|day rate|per day|contract rate)\b/.test(near)) return `${raw} / year`;
  return raw;
}

function extractVisa(text: string): VisaInfo {
  const t = text.toLowerCase();
  const yesRe = /\b(visa sponsorship|sponsor (?:for )?(?:work )?visas?|sponsorship (?:is )?(?:available|provided)|we sponsor|will sponsor|h-?1b sponsorship|sponsor h-?1b|transfer h-?1b)\b/;
  const noRe = /\b(no visa sponsorship|unable to sponsor|cannot sponsor|will not sponsor|we (?:do|are) not able to sponsor|not offering sponsorship|no sponsorship)\b/;
  const constraintRe =
    /\b(must (?:be|already be) (?:authorized|legally authorized|eligible to work)|authorized to work in|right to work|work authorization|work permit|legally permitted to work|eligib\w* to work|us work authorization|no relocation assistance)\b/;

  const yes = t.match(yesRe);
  const no = t.match(noRe);
  const constraint = t.match(constraintRe);

  if (yes && !no) {
    const bits: string[] = [];
    if (/\bh-?1b\b/.test(yes[0] || "")) bits.push("H-1B mentioned");
    if (/transfer/.test(yes[0] || "")) bits.push("transfers considered");
    return { status: "yes", note: bits.length ? `Yes — ${bits.join(", ")}` : "Yes — sponsorship offered" };
  }
  if (no) return { status: "no", note: `No — ${norm(no[0] || "")}` };
  if (constraint) {
    return { status: "constraint", note: `Must have: ${norm(constraint[0] || "").replace(/\.$/, "")}` };
  }
  return { status: "unknown", note: "Not stated in JD" };
}

function extractEmail(text: string): string {
  const m = text.match(EMAIL_RE);
  return m ? m[0] : "";
}

function extractPosted(text: string): string {
  const rel = text.match(/\b(posted|published)\s*(?:today|just now|yesterday|\d+\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\s*ago)\b/i);
  if (rel) return norm(rel[0] || "");
  const date = text.match(/\b(?:posted|published)\s*[:\-–—]?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}/i);
  if (date) return norm(date[0] || "");
  return "";
}

function extractApplicants(text: string): string {
  const m = text.match(/([\d,]+)\s*(?:\+?\s*)?(?:applicants?|candidates)\s*(?:have )?(?:already )?applied/i);
  if (m) return norm(m[0] || "");
  return "";
}

export function parseJD(raw: string): ParsedJD {
  const text = norm(raw.replace(/[ \t]+/g, " "));
  if (!text) throw new Error("The JD is empty.");
  const workMode = extractWorkMode(text);
  return {
    company: extractCompany(text),
    role: extractRole(text),
    location: extractLocation(text, workMode),
    workMode,
    salary: extractSalary(text),
    visa: extractVisa(text),
    email: extractEmail(text),
    posted: extractPosted(text),
    applicants: extractApplicants(text),
  };
}

export const SAMPLE_JD = `Senior Frontend Engineer
Lumen Analytics — Remote (US)

About us:
Lumen Analytics builds real-time observability dashboards used by 4,000+ engineering teams. We're a remote-first company founded in 2019, backed by Series B funding.

The role:
We're hiring a Senior Frontend Engineer to own our core dashboard experience. You'll work closely with product and design to ship accessible, high-performance interfaces.

What you'll do:
- Build and maintain features in React and TypeScript across a large design system
- Drive web performance work: code-splitting, rendering optimizations, Core Web Vitals
- Partner with backend engineers on GraphQL and REST APIs
- Write meaningful tests (we use Playwright and Vitest) and review code with care
- Mentor mid-level engineers and contribute to our engineering blog

What we're looking for:
- 5+ years of frontend experience with React and TypeScript
- Deep familiarity with CSS, accessibility (WCAG), and browser performance profiling
- Experience with data visualization (we use D3.js) is a strong plus
- Comfort with CI/CD pipelines, Docker, and AWS (EC2, S3, CloudFront)
- Bonus: experience with WebSockets/real-time rendering, Terraform, or Rust/WASM

Details:
- Salary: $150,000 – $185,000 / year + equity
- Location: Remote (US), with optional co-working space in Austin, TX
- Visa: We are unable to sponsor visas for this role; candidates must be authorized to work in the United States
- 142 applicants have applied so far. Posted 3 days ago.

Questions? Reach out to talent@lumen-analytics.io. Apply by sending your resume to the link below.`;
