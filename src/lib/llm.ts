import type { Generated, MasterResume, ParsedJD, Profile } from "./types";
import { buildResumeLaTeX } from "./latex";

/**
 * LLM adapters for OpenAI, Google Gemini, and OpenRouter.
 * The tailoring prompt is strict: rewrite phrasing only — never invent
 * skills, employers, dates, numbers, or achievements.
 */

export const DEFAULT_MODELS: Record<Profile["provider"], string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  openrouter: "openai/gpt-4o-mini",
};

const SYSTEM = `You are a meticulous resume tailoring assistant. You rewrite an existing master resume for a specific job description under STRICT rules:

1. NEVER invent skills, employers, job titles, dates, metrics, numbers, or achievements that are not in the master resume. If you cannot truthfully say something, omit it.
2. You MAY: adjust the professional role title to match the job posting; tighten phrasing; start bullets with strong action verbs; reorder bullets by relevance to the job description; rewrite the summary in a grounded, non-exaggerated way; weave in the user-selected keywords ONLY where the candidate's existing experience truthfully supports them.
3. Keep every employer name, job title, date range, and education entry exactly as given.
4. Keep the resume to roughly the same length. Plain text only, no markdown.
5. Also write a concise, specific cover letter (220–320 words, 3–4 short paragraphs) for this application. Ground every claim in the master resume. Do not invent enthusiasm details or facts.
6. Respond with ONLY a JSON object, no prose before or after, in exactly this shape:
{"roleTitle": string, "summary": string, "skillsLine": string, "experience": [{"company": string, "title": string, "dates": string, "bullets": [string]}], "education": [{"school": string, "degree": string, "dates": string}], "coverLetter": string}`;

function userPrompt(resume: MasterResume, jdText: string, parsed: ParsedJD, keywords: string[]): string {
  return [
    `MASTER RESUME (plain text):`,
    `<<<RESUME`,
    (resume.text || resume.texSource || "").slice(0, 14000),
    `RESUME>>>`,
    ``,
    `JOB DESCRIPTION:`,
    `<<<JD`,
    jdText.slice(0, 8000),
    `JD>>>`,
    ``,
    `EXTRACTED (treat as facts — leave a field empty if blank):`,
    `Company: ${parsed.company}`,
    `Role: ${parsed.role}`,
    `Location: ${parsed.location}`,
    `Work mode: ${parsed.workMode}`,
    ``,
    `USER-SELECTED KEYWORDS TO EMPHASIZE (use only where truthful):`,
    keywords.length ? keywords.join(", ") : "(none)",
    ``,
    `Return the JSON object now.`,
  ].join("\n");
}

async function callProvider(profile: Profile, system: string, user: string): Promise<string> {
  const model = profile.model.trim() || DEFAULT_MODELS[profile.provider];

  if (profile.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${profile.apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(friendlyHttp(res.status, data?.error?.message));
    return data?.choices?.[0]?.message?.content ?? "";
  }

  if (profile.provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(profile.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(friendlyHttp(res.status, data?.error?.message));
    return data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  }

  // openrouter
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.apiKey}`,
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "Matchbook",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(friendlyHttp(res.status, data?.error?.message));
  return data?.choices?.[0]?.message?.content ?? "";
}

function friendlyHttp(status: number, msg?: string): string {
  if (status === 401) return `HTTP 401 — the API key was rejected. Check it in Profile.`;
  if (status === 429) return `HTTP 429 — rate limited. Wait a moment and try again. ${msg ?? ""}`;
  if (status === 404) return `HTTP 404 — model not found. Check the model name in Profile. ${msg ?? ""}`;
  return `HTTP ${status}${msg ? ` — ${msg}` : ""}`;
}

function extractJSON(raw: string): unknown {
  const cleaned = raw.trim().replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("The model returned malformed JSON — try again or switch model in Profile.");
  }
}

export interface GenerateArgs {
  profile: Profile;
  resume: MasterResume;
  jdText: string;
  parsed: ParsedJD;
  keywords: string[];
}

export async function generateTailored(args: GenerateArgs): Promise<Generated> {
  const raw = await callProvider(args.profile, SYSTEM, userPrompt(args.resume, args.jdText, args.parsed, args.keywords));
  const obj = extractJSON(raw) as {
    roleTitle?: string;
    summary?: string;
    skillsLine?: string;
    experience?: { company?: string; title?: string; dates?: string; bullets?: string[] }[];
    education?: { school?: string; degree?: string; dates?: string }[];
    coverLetter?: string;
  };

  const nameGuess = (args.resume.text || "").split("\n").map((l) => l.trim()).find((l) => l.length > 2 && l.length <= 40 && /^[A-Z][a-zA-Z.'-]*( [A-Z][a-zA-Z.'-]*){1,3}$/.test(l)) ?? "Your Name";

  const resume = {
    contact: {
      name: nameGuess,
      email: ((args.resume.text || "").match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/) ?? [""])[0],
      phone: ((args.resume.text || "").match(/(\+?\d[\d ().-]{7,}\d)/) ?? [""])[0],
      location: "",
    },
    roleTitle: obj.roleTitle ?? "",
    summary: obj.summary ?? "",
    skillsLine: obj.skillsLine ?? "",
    experience: (obj.experience ?? []).map((e) => ({
      company: e.company ?? "",
      title: e.title ?? "",
      dates: e.dates ?? "",
      bullets: (e.bullets ?? []).map((b) => b.replace(/^[-•*]\s*/, "")),
    })),
    education: (obj.education ?? []).map((e) => ({
      school: e.school ?? "",
      degree: e.degree ?? "",
      dates: e.dates ?? "",
    })),
  };

  return {
    resume,
    coverLetter: obj.coverLetter ?? "",
    latex: buildResumeLaTeX(resume),
  };
}

/** Small ping used by the Profile "Test key" button. */
export async function testKey(profile: Profile): Promise<string> {
  const out = await callProvider(profile, "Reply with the single word OK.", "ping");
  return out.trim().slice(0, 40) || "OK";
}
