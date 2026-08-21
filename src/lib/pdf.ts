import { jsPDF } from "jspdf";
import type { StructuredResume } from "./types";

/**
 * Client-side PDF rendering that mirrors the single-column, ATS-safe LaTeX
 * template: Helvetica, no tables, no columns, no graphics.
 */

const PAGE_W = 612; // letter, points
const PAGE_H = 792;
const M = 54; // 0.75in margins
const W = PAGE_W - M * 2;

const INK: [number, number, number] = [25, 27, 32];
const SOFT: [number, number, number] = [96, 101, 111];
const RULE: [number, number, number] = [180, 181, 171];

export function renderResumePDF(r: StructuredResume): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = M;

  const ensure = (need: number) => {
    if (y + need > PAGE_H - M) {
      doc.addPage();
      y = M;
    }
  };

  const section = (title: string) => {
    ensure(46);
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text(title.toUpperCase(), M, y);
    y += 5;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.8);
    doc.line(M, y, PAGE_W - M, y);
    y += 14;
  };

  const para = (text: string, size = 10, color: [number, number, number] = INK, indent = 0) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(text, W - indent) as string[];
    for (const line of wrapped) {
      ensure(14);
      doc.text(line, M + indent, y);
      y += size * 1.42;
    }
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...INK);
  doc.text(r.contact.name || "Your Name", PAGE_W / 2, y + 6, { align: "center" });
  y += 14;
  const contactBits = [r.contact.email, r.contact.phone, r.contact.location].filter(Boolean);
  if (contactBits.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    doc.text(contactBits.join("   ·   "), PAGE_W / 2, y + 6, { align: "center" });
    y += 12;
  }

  if (r.roleTitle) {
    ensure(26);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(r.roleTitle, PAGE_W / 2, y, { align: "center" });
    y += 6;
  }

  if (r.summary) {
    section("Summary");
    para(r.summary);
  }
  if (r.skillsLine) {
    section("Skills");
    para(r.skillsLine);
  }

  if (r.experience.length) {
    section("Experience");
    for (const e of r.experience) {
      ensure(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      doc.text(e.title || "Role", M, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...SOFT);
      doc.text(e.dates || "", PAGE_W - M, y, { align: "right" });
      y += 13;
      if (e.company) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        doc.text(e.company, M, y);
        y += 13;
      }
      for (const b of e.bullets) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        const wrapped = doc.splitTextToSize(b, W - 14) as string[];
        wrapped.forEach((line, i) => {
          ensure(14);
          doc.text(i === 0 ? "•" : "", M + 2, y);
          doc.text(line, M + 14, y);
          y += 14;
        });
        y += 1.5;
      }
      y += 8;
    }
  }

  if (r.education.length) {
    section("Education");
    for (const ed of r.education) {
      ensure(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      doc.text(ed.degree || "Degree", M, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...SOFT);
      doc.text(ed.dates || "", PAGE_W - M, y, { align: "right" });
      y += 13;
      if (ed.school) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text(ed.school, M, y);
        y += 14;
      }
      y += 6;
    }
  }

  return doc;
}

export function renderCoverPDF(letter: string, name: string): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = M + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(name || "Cover Letter", M, y);
  y += 10;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.8);
  doc.line(M, y, M + 120, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SOFT);
  doc.text(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }), M, y);
  y += 26;

  const paragraphs = letter.replace(/\r/g, "").split(/\n+/);
  for (const p of paragraphs) {
    if (!p.trim()) continue;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    const wrapped = doc.splitTextToSize(p.trim(), W) as string[];
    for (const line of wrapped) {
      if (y + 16 > PAGE_H - M) {
        doc.addPage();
        y = M;
      }
      doc.text(line, M, y);
      y += 15;
    }
    y += 8;
  }
  return doc;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function sanitizeName(s: string): string {
  return (s || "document").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "document";
}
