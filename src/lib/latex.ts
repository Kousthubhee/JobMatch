import type { StructuredResume } from "./types";

/**
 * Clean, ATS-safe single-column LaTeX template.
 * No tables, no columns, no graphics — parseable by any ATS.
 */

export function escapeLaTeX(s: string): string {
  return (s ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

export function buildResumeLaTeX(r: StructuredResume): string {
  const contact = [r.contact.email, r.contact.phone, r.contact.location].filter(Boolean).join("  $\\cdot$  ");
  const lines: string[] = [];
  lines.push(`\\documentclass[10.5pt,letterpaper]{article}`);
  lines.push(`\\usepackage[margin=0.6in,top=0.55in,bottom=0.55in]{geometry}`);
  lines.push(`\\usepackage[T1]{fontenc}`);
  lines.push(`\\usepackage{helvet}`);
  lines.push(`\\renewcommand{\\familydefault}{\\sfdefault}`);
  lines.push(`\\usepackage{enumitem}`);
  lines.push(`\\usepackage{titlesec}`);
  lines.push(`\\usepackage[hidelinks]{hyperref}`);
  lines.push(`\\pagestyle{empty}`);
  lines.push(`\\setlist[itemize]{leftmargin=1.4em,itemsep=2pt,parsep=0pt,topsep=3pt}`);
  lines.push(`\\titleformat{\\section}{\\large\\bfseries\\uppercase}{}{0em}{}[\\vspace{-0.6em}\\hrule\\vspace{0.45em}]`);
  lines.push(`\\titlespacing*{\\section}{0pt}{1.1em}{0.35em}`);
  lines.push(``);
  lines.push(`\\begin{document}`);
  lines.push(``);
  lines.push(`\\begin{center}`);
  lines.push(`{\\LARGE\\bfseries ${escapeLaTeX(r.contact.name || "Your Name")}}\\\\[3pt]`);
  if (contact) lines.push(`{\\small ${escapeLaTeX(contact)}}`);
  lines.push(`\\end{center}`);
  lines.push(`\\vspace{0.4em}`);

  if (r.roleTitle) {
    lines.push(`\\begin{center}{\\normalsize\\bfseries ${escapeLaTeX(r.roleTitle)}}\\end{center}`);
    lines.push(`\\vspace{0.2em}`);
  }

  if (r.summary) {
    lines.push(`\\section{Summary}`);
    lines.push(escapeLaTeX(r.summary));
  }

  if (r.skillsLine) {
    lines.push(`\\section{Skills}`);
    lines.push(escapeLaTeX(r.skillsLine));
  }

  if (r.experience.length > 0) {
    lines.push(`\\section{Experience}`);
    for (const e of r.experience) {
      lines.push(`\\noindent\\textbf{${escapeLaTeX(e.title || "Role")}} \\hfill {\\small ${escapeLaTeX(e.dates || "")}}\\\\`);
      lines.push(`\\noindent\\textit{${escapeLaTeX(e.company || "")}}\\\\`);
      if (e.bullets.length > 0) {
        lines.push(`\\begin{itemize}`);
        for (const b of e.bullets) lines.push(`  \\item ${escapeLaTeX(b)}`);
        lines.push(`\\end{itemize}`);
      }
      lines.push(`\\vspace{0.35em}`);
    }
  }

  if (r.education.length > 0) {
    lines.push(`\\section{Education}`);
    for (const ed of r.education) {
      lines.push(`\\noindent\\textbf{${escapeLaTeX(ed.degree || "Degree")}} \\hfill {\\small ${escapeLaTeX(ed.dates || "")}}\\\\`);
      if (ed.school) lines.push(`\\noindent\\textit{${escapeLaTeX(ed.school)}}\\\\`);
      lines.push(`\\vspace{0.2em}`);
    }
  }

  lines.push(`\\end{document}`);
  return lines.join("\n");
}
