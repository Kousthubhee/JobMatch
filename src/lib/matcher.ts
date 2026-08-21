import type { MatchResult, MatchTerm } from "./types";

/**
 * ATS keyword matching: extract skills/terms from the JD, check which ones
 * appear in the master resume, and score coverage. Purely deterministic —
 * the reasoning shown to the user is exactly what was computed.
 */

const DICT: { name: string; aliases: string[] }[] = [
  { name: "JavaScript", aliases: ["javascript", "js", "es6", "ecmascript"] },
  { name: "TypeScript", aliases: ["typescript", "ts"] },
  { name: "React", aliases: ["react", "reactjs", "react.js"] },
  { name: "Next.js", aliases: ["next.js", "nextjs"] },
  { name: "Node.js", aliases: ["node.js", "nodejs", "node"] },
  { name: "Vue", aliases: ["vue", "vue.js", "vuejs", "nuxt"] },
  { name: "Angular", aliases: ["angular"] },
  { name: "Svelte", aliases: ["svelte", "sveltekit"] },
  { name: "HTML", aliases: ["html", "html5"] },
  { name: "CSS", aliases: ["css", "css3"] },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss", "tailwind css"] },
  { name: "Sass/SCSS", aliases: ["sass", "scss", "less"] },
  { name: "Redux", aliases: ["redux", "rtk"] },
  { name: "GraphQL", aliases: ["graphql", "apollo"] },
  { name: "REST APIs", aliases: ["rest", "restful", "rest api", "rest apis"] },
  { name: "Python", aliases: ["python", "py"] },
  { name: "Django", aliases: ["django"] },
  { name: "Flask", aliases: ["flask", "fastapi"] },
  { name: "Java", aliases: ["java", "spring", "spring boot"] },
  { name: "Kotlin", aliases: ["kotlin"] },
  { name: "Scala", aliases: ["scala", "spark"] },
  { name: "Go", aliases: ["golang", "go"] },
  { name: "Rust", aliases: ["rust"] },
  { name: "C++", aliases: ["c++", "cpp"] },
  { name: "C#", aliases: ["c#", ".net", "dotnet", "asp.net"] },
  { name: "Ruby", aliases: ["ruby", "rails", "ruby on rails"] },
  { name: "PHP", aliases: ["php", "laravel", "symfony"] },
  { name: "Swift", aliases: ["swift", "swiftui"] },
  { name: "iOS", aliases: ["ios"] },
  { name: "Android", aliases: ["android", "jetpack compose"] },
  { name: "React Native", aliases: ["react native"] },
  { name: "Flutter", aliases: ["flutter", "dart"] },
  { name: "SQL", aliases: ["sql", "mysql", "postgresql", "postgres", "mariadb", "sqlite"] },
  { name: "NoSQL", aliases: ["nosql", "mongodb", "mongo", "dynamodb", "cassandra", "redis", "couchdb"] },
  { name: "Elasticsearch", aliases: ["elasticsearch", "opensearch"] },
  { name: "AWS", aliases: ["aws", "amazon web services", "ec2", "lambda", "s3", "cloudfront", "ecs", "rds"] },
  { name: "GCP", aliases: ["gcp", "google cloud"] },
  { name: "Azure", aliases: ["azure"] },
  { name: "Docker", aliases: ["docker", "containers"] },
  { name: "Kubernetes", aliases: ["kubernetes", "k8s", "helm"] },
  { name: "Terraform", aliases: ["terraform", "iac"] },
  { name: "CI/CD", aliases: ["ci/cd", "cicd", "continuous integration", "continuous delivery", "jenkins", "github actions", "gitlab ci", "circleci", "buildkite"] },
  { name: "Git", aliases: ["git", "github", "gitlab", "bitbucket"] },
  { name: "Linux", aliases: ["linux", "unix", "bash", "shell scripting"] },
  { name: "Machine Learning", aliases: ["machine learning", "ml", "deep learning", "neural networks"] },
  { name: "PyTorch", aliases: ["pytorch", "torch"] },
  { name: "TensorFlow", aliases: ["tensorflow", "keras"] },
  { name: "LLMs", aliases: ["llm", "llms", "large language models", "generative ai", "genai", "rag", "prompt engineering"] },
  { name: "NLP", aliases: ["nlp", "natural language processing"] },
  { name: "Computer Vision", aliases: ["computer vision", "opencv"] },
  { name: "Pandas", aliases: ["pandas", "numpy", "scikit-learn", "sklearn"] },
  { name: "Data Pipelines", aliases: ["etl", "elt", "airflow", "dbt", "data pipelines"] },
  { name: "Kafka", aliases: ["kafka", "rabbitmq", "message queues"] },
  { name: "Tableau", aliases: ["tableau", "looker", "power bi", "looker studio"] },
  { name: "Figma", aliases: ["figma", "sketch"] },
  { name: "Design Systems", aliases: ["design system", "design systems", "storybook"] },
  { name: "Accessibility", aliases: ["accessibility", "a11y", "wcag", "aria"] },
  { name: "Web Performance", aliases: ["web performance", "performance optimization", "core web vitals", "lighthouse"] },
  { name: "Testing", aliases: ["testing", "unit testing", "jest", "vitest", "playwright", "cypress", "selenium", "pytest", "rspec", "junit", "mocha", "tdd"] },
  { name: "Agile/Scrum", aliases: ["agile", "scrum", "kanban", "sprint"] },
  { name: "Jira", aliases: ["jira", "confluence", "asana", "linear"] },
  { name: "Microservices", aliases: ["microservices", "micro-services", "distributed systems"] },
  { name: "Serverless", aliases: ["serverless", "faas"] },
  { name: "gRPC", aliases: ["grpc", "protobuf"] },
  { name: "WebSockets", aliases: ["websockets", "websocket", "real-time"] },
  { name: "OAuth/SSO", aliases: ["oauth", "sso", "saml", "openid", "auth0", "identity"] },
  { name: "Security", aliases: ["security", "owasp", "penetration testing", "appsec", "soc 2"] },
  { name: "Monitoring", aliases: ["monitoring", "observability", "grafana", "prometheus", "datadog", "new relic", "sentry"] },
  { name: "SEO", aliases: ["seo", "search engine optimization"] },
  { name: "Product Management", aliases: ["product management", "roadmap", "stakeholder management"] },
  { name: "Data Analysis", aliases: ["data analysis", "analytics", "a/b testing", "experimentation"] },
  { name: "Statistics", aliases: ["statistics", "statistical", "regression"] },
  { name: "Excel", aliases: ["excel", "spreadsheets", "google sheets"] },
  { name: "Communication", aliases: ["communication", "cross-functional", "collaboration"] },
  { name: "Leadership", aliases: ["leadership", "mentoring", "mentorship", "team leadership"] },
  { name: "Service Mesh", aliases: ["service mesh", "istio"] },
  { name: "D3.js", aliases: ["d3", "d3.js", "data visualization", "dataviz"] },
  { name: "Vite/Webpack", aliases: ["vite", "webpack", "build tooling", "esbuild", "rollup"] },
];

const STOP = new Set((
  "the and with you your our will are for that this have has not but all can who what when where how were was isnt arent dont cant " +
  "a an to of in on as at by be is it or if about into through during before after above below from up down out off over under again " +
  "further then once here there why so than too very just also more most other some such only own same now able across along among " +
  "around within without using use used work working team teams role job company position candidate candidates experience experienced " +
  "years year strong excellent good great knowledge familiar understanding skills skill ability including include includes etc required " +
  "requirements requirement preferred qualifications responsibilities responsibility duties plus bonus nice must should would like well " +
  "new day days week help us youll youre they their them these those each per may via join looking seeking apply application please " +
  "opportunity location remote hybrid onsite full time part contract permanent benefits equity bonus base salary compensation paid " +
  "health dental vision 401k retirement vacation flexible hours office hours monday tuesday wednesday thursday friday " +
  "we us our their his her its been being do does did done doing get gets got getting make makes made making build builds built " +
  "building deliver delivers delivering create creates created creating develop develops developed developing design designs designed " +
  "designing implement implements implemented implementing maintain maintains maintained maintaining support supports supported " +
  "supporting improve improves improving drive drives driving own owns owning lead leads leading collaborate collaborates partner " +
  "partners communicate communicates ensure ensures ensuring identify identifies identifying analyze analyzes analyzing solve solves " +
  "solving ship ships shipping launch launches launching contribute contributes contributing participate participates relevant related " +
  "proven track record expertise proficiency expert advanced solid hands-on demonstrated passion passionate excited love enjoy " +
  "degree bachelors masters phd computer science information engineering field equivalent practical comfortable confidence " +
  "independently minimal supervision fast-paced dynamic growing startup enterprise customers users products services solutions platform " +
  "projects initiatives efforts goals objectives outcomes impact value quality standards best practices patterns principles " +
  "mentor guide coach train onboard hire interviewing interview process screen screening phone video technical coding challenge " +
  "employer equal opportunity affirmatively encourage applicants regardless race color religion gender identity orientation national " +
  "origin disability veteran status committed inclusive diverse workplace culture mission vision values founded series seed funding " +
  "questions reach contact email mail apply clicking button below submit resume cover letter references available immediately notice " +
  "period relocation assistance visa sponsorship authorization legally united states uk eu canada india remote-first distributed"
).split(/\s+/));

const ROLE_GENERIC = new Set([
  "senior", "junior", "staff", "principal", "lead", "sr", "jr", "entry", "level",
  "engineer", "engineers", "developer", "developers", "designer", "manager", "analyst",
  "scientist", "architect", "consultant", "specialist", "director", "intern", "associate",
  "software", "frontend", "backend", "fullstack", "full-stack", "front-end", "back-end",
  "data", "product", "engineering",
]);

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasTerm(text: string, alias: string): boolean {
  const re = new RegExp(`(?<![a-z0-9+#.])${esc(alias.toLowerCase())}(?![a-z0-9+#])`, "i");
  return re.test(text);
}

function prettyTerm(t: string): string {
  if (/^[a-z0-9+#./]+$/.test(t)) {
    return t.length <= 5 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);
  }
  return t;
}

export function findJdKeywords(jdText: string): MatchTerm[] {
  const jd = jdText.toLowerCase();
  const found: MatchTerm[] = [];
  const covered = new Set<string>();

  for (const entry of DICT) {
    if (entry.aliases.some((a) => hasTerm(jd, a))) {
      found.push({ term: entry.name, kind: "skill" });
      entry.aliases.forEach((a) => covered.add(a.toLowerCase()));
    }
  }

  // Extra terms: acronyms / CamelCase / alphanumeric tokens not in the dictionary
  const raw = jdText.replace(/https?:\/\/\S+|[\w.+-]+@[\w-]+\.\w+/g, " ");
  const tokens = raw.split(/[^A-Za-z0-9+#./'-]+/).filter(Boolean);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < 2 || t.length > 24) continue;
    const low = t.toLowerCase().replace(/[.'’-]+$/, "");
    if (low.length < 2) continue;
    if (STOP.has(low)) continue;
    if (covered.has(low)) continue;
    if (ROLE_GENERIC.has(low)) continue;
    if (/^\d+$/.test(low)) continue;
    const isAcronym = /^[A-Z0-9+#./]{2,10}$/.test(t) && /[A-Z]/.test(t);
    const isCamel = /[a-z][A-Z]/.test(t) || (/\./.test(t) && /[A-Z]/.test(t));
    const isToolish = /^[a-z0-9][a-z0-9+#./-]*$/.test(t) && /\d/.test(t) && t.length >= 4;
    if (!isAcronym && !isCamel && !isToolish) continue;
    freq.set(low, (freq.get(low) ?? 0) + 1);
  }
  const extras = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, 14)
    .map(([term]) => ({ term: prettyTerm(term), kind: "term" as const }));

  const seen = new Set<string>();
  return [...found, ...extras].filter((t) => {
    const k = t.term.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function scoreMatch(jdText: string, resumeText: string): MatchResult {
  const keywords = findJdKeywords(jdText);
  const resume = (resumeText || "").toLowerCase();
  const matched: MatchTerm[] = [];
  const missing: MatchTerm[] = [];
  let matchedW = 0;
  let totalW = 0;

  for (const kw of keywords) {
    const w = kw.kind === "skill" ? 2 : 1;
    totalW += w;
    const aliases = DICT.find((d) => d.name === kw.term)?.aliases ?? [kw.term.toLowerCase()];
    const hit = resume.length > 0 && aliases.some((a) => hasTerm(resume, a));
    if (hit) {
      matched.push(kw);
      matchedW += w;
    } else {
      missing.push(kw);
    }
  }

  const score = totalW === 0 ? 0 : Math.round((matchedW / totalW) * 100);
  return { score, matched, missing };
}
