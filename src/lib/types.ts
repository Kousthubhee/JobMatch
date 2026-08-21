export type Provider = "openai" | "gemini" | "openrouter";

export interface Profile {
  provider: Provider;
  apiKey: string;
  model: string;
  oauthClientId: string;
  sheetId: string;
  driveFolderId: string;
}

export interface MasterResume {
  fileName: string;
  text: string;
  texSource: string;
  addedAt: number;
}

export interface VisaInfo {
  status: "yes" | "no" | "constraint" | "unknown";
  note: string;
}

export interface ParsedJD {
  company: string;
  role: string;
  location: string;
  workMode: string;
  salary: string;
  visa: VisaInfo;
  email: string;
  posted: string;
  applicants: string;
}

export interface MatchTerm {
  term: string;
  kind: "skill" | "term";
}

export interface MatchResult {
  score: number;
  matched: MatchTerm[];
  missing: MatchTerm[];
}

export interface ResumeExp {
  company: string;
  title: string;
  dates: string;
  bullets: string[];
}

export interface StructuredResume {
  contact: { name: string; email: string; phone: string; location: string };
  roleTitle: string;
  summary: string;
  skillsLine: string;
  experience: ResumeExp[];
  education: { school: string; degree: string; dates: string }[];
}

export interface Generated {
  resume: StructuredResume;
  coverLetter: string;
  latex: string;
}

export interface Application {
  id: string;
  date: string;
  company: string;
  role: string;
  link: string;
  location: string;
  match: number;
  workMode: string;
  salary: string;
  posted: string;
  applicants: string;
  visa: string;
  email: string;
  hasDocs: boolean;
}

export interface Session {
  step: 0 | 1 | 2 | 3;
  jdText: string;
  parsed: ParsedJD | null;
  match: MatchResult | null;
  selected: string[];
  customKw: string;
  generated: Generated | null;
  error: string;
  tracking: "idle" | "working" | "done" | "skipped";
  googleStatus: string;
}

export const DEFAULT_SESSION: Session = {
  step: 0,
  jdText: "",
  parsed: null,
  match: null,
  selected: [],
  customKw: "",
  generated: null,
  error: "",
  tracking: "idle",
  googleStatus: "",
};

export const DEFAULT_PROFILE: Profile = {
  provider: "openai",
  apiKey: "",
  model: "",
  oauthClientId: "",
  sheetId: "",
  driveFolderId: "",
};
