import { useEffect, useRef, useState } from "react";
import { IconAlert, IconCheck, IconCopy, IconX } from "./icons";

/* ---------------- toasts ---------------- */

type ToastKind = "ok" | "err" | "info" | "warn";
interface ToastItem {
  id: number;
  kind: ToastKind;
  msg: string;
}

let toastListeners: ((t: ToastItem[]) => void)[] = [];
let currentToasts: ToastItem[] = [];
let nextToastId = 1;

export function toast(msg: string, kind: ToastKind = "ok") {
  const item: ToastItem = { id: nextToastId++, kind, msg };
  currentToasts = [...currentToasts.slice(-3), item];
  toastListeners.forEach((l) => l(currentToasts));
  window.setTimeout(() => {
    currentToasts = currentToasts.filter((t) => t.id !== item.id);
    toastListeners.forEach((l) => l(currentToasts));
  }, 3800);
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>(currentToasts);
  useEffect(() => {
    const l = (t: ToastItem[]) => setItems(t);
    toastListeners.push(l);
    return () => {
      toastListeners = toastListeners.filter((x) => x !== l);
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`anim-toast pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-3 shadow-lg text-[13px] font-semibold ${
            t.kind === "ok"
              ? "bg-night text-bone border-nightline"
              : t.kind === "err"
                ? "bg-coral text-[#fdf3ef] border-[rgba(0,0,0,0.15)]"
                : t.kind === "warn"
                  ? "bg-amberlight text-[#6d4c07] border-[rgba(160,107,8,0.4)]"
                  : "bg-panel text-ink border-line"
          }`}
        >
          {t.kind === "ok" ? (
            <IconCheck size={15} className="text-[#5ecb95]" strokeWidth={2.6} />
          ) : t.kind === "err" ? (
            <IconX size={15} strokeWidth={2.6} />
          ) : t.kind === "warn" ? (
            <IconAlert size={15} />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-moss" />
          )}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ---------------- score ring ---------------- */

export function bandLabel(score: number): string {
  if (score >= 75) return "Strong match";
  if (score >= 55) return "Decent match";
  if (score >= 35) return "Partial match";
  return "Weak match";
}

export function ScoreRing({ score }: { score: number }) {
  const R = 56;
  const C = 2 * Math.PI * R;
  const [shown, setShown] = useState(0);
  const [offset, setOffset] = useState(C);
  const raf = useRef<number>(0);

  useEffect(() => {
    const t = window.setTimeout(() => setOffset(C - (C * score) / 100), 60);
    const start = performance.now();
    const dur = 1050;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(eased * score));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf.current);
    };
  }, [score, C]);

  const color = score >= 70 ? "#106b45" : score >= 45 ? "#a06b08" : "#cf4423";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={150} height={150} viewBox="0 0 150 150" className="-rotate-90">
        <circle cx={75} cy={75} r={R} strokeWidth={11} fill="none" className="ring-track" />
        <circle
          cx={75}
          cy={75}
          r={R}
          strokeWidth={11}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          className="ring-value"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-[42px] leading-none" style={{ color }}>
          {shown}
          <span className="text-[20px] align-top">%</span>
        </span>
        <span className="label-mono mt-1.5">ats match</span>
      </div>
    </div>
  );
}

/* ---------------- stepper ---------------- */

const STEP_LABELS = ["Paste JD", "Match review", "Keywords", "Export & track"];

export function Stepper({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => done && onJump(i)}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                done ? "cursor-pointer hover:bg-mosslight" : "cursor-default"
              }`}
              disabled={!done && !active}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-semibold transition-colors duration-200 ${
                  done
                    ? "bg-moss text-[#f0f6ef]"
                    : active
                      ? "bg-ink text-bone ring-4 ring-[rgba(25,27,32,0.12)]"
                      : "bg-linesoft text-ink3"
                }`}
              >
                {done ? <IconCheck size={12} strokeWidth={2.8} /> : i + 1}
              </span>
              <span
                className={`text-[12.5px] font-semibold tracking-tight ${
                  active ? "text-ink" : done ? "text-moss" : "text-ink3"
                }`}
              >
                {label}
              </span>
            </button>
            {i < STEP_LABELS.length - 1 && (
              <span className={`h-px w-7 transition-colors duration-300 ${i < current ? "bg-moss" : "bg-line"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- docket (extracted JD fields) ---------------- */

export function Docket({
  rows,
}: {
  rows: { label: string; value: React.ReactNode; hint?: string }[];
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-x-8">
      {rows.map((r, i) => (
        <div
          key={r.label}
          className="flex items-baseline justify-between gap-4 py-2.5 border-b border-dashed border-linesoft anim-fade-up"
          style={{ animationDelay: `${i * 45}ms` }}
        >
          <span className="label-mono shrink-0">{r.label}</span>
          <span className={`text-[13.5px] font-semibold text-right truncate ${r.value ? "text-ink" : "text-ink3 italic font-normal"}`}>
            {r.value || (r.hint ?? "Not in JD")}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- copy button ---------------- */

export function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-outline btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <IconCheck size={14} strokeWidth={2.4} /> : <IconCopy size={14} />}
      {copied ? "Copied" : label}
    </button>
  );
}
