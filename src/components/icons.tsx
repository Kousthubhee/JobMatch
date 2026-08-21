import React from "react";

type P = { size?: number; className?: string; strokeWidth?: number };

function base(props: P, children: React.ReactNode, viewBox = "0 0 24 24") {
  const { size = 18, className = "", strokeWidth = 1.8 } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Matchbook logo: strike-pad + three matches, one lit. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4.5" y="10" width="23" height="18" rx="3" fill="#22252D" stroke="#3A3E49" />
      <rect x="8" y="14" width="3.2" height="11" rx="1.6" fill="#EDEEE6" />
      <rect x="14.4" y="14" width="3.2" height="11" rx="1.6" fill="#EDEEE6" />
      <rect x="20.8" y="14" width="3.2" height="11" rx="1.6" fill="#EDEEE6" />
      <circle cx="9.6" cy="13" r="2.6" fill="#177A4C" />
      <circle cx="22.4" cy="13" r="2.6" fill="#C98A12" />
      <g className="flame">
        <path
          d="M16 3.2c1.5 2 2.8 3.1 2.8 5a2.8 2.8 0 1 1-5.6 0c0-1.9 1.3-3 2.8-5z"
          fill="#E05A2B"
        />
        <path d="M16 6.4c.7 1 1.2 1.5 1.2 2.4a1.2 1.2 0 1 1-2.4 0c0-.9.5-1.4 1.2-2.4z" fill="#F5C56B" />
      </g>
    </svg>
  );
}

export const IconFlame = (p: P) =>
  base(p, <path d="M12 3c2.5 3.2 5 5.4 5 9a5 5 0 0 1-10 0c0-3.6 2.5-5.8 5-9z M12 13.5c.9 1.2 1.6 1.9 1.6 3a1.6 1.6 0 1 1-3.2 0c0-1.1.7-1.8 1.6-3z" />);

export const IconTarget = (p: P) =>
  base(p, <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>);

export const IconDoc = (p: P) =>
  base(p, <><path d="M6 3.5h8l4 4V20.5H6z" /><path d="M14 3.5V8h4" /><path d="M9 12h6M9 15.5h6" /></>);

export const IconUpload = (p: P) =>
  base(p, <><path d="M12 15V4.5" /><path d="M7.5 9L12 4.5 16.5 9" /><path d="M4.5 15.5v4h15v-4" /></>);

export const IconDownload = (p: P) =>
  base(p, <><path d="M12 4.5V15" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M4.5 15.5v4h15v-4" /></>);

export const IconScan = (p: P) =>
  base(p, <><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M4 12h16" /></>);

export const IconTable = (p: P) =>
  base(p, <><rect x="4" y="5" width="16" height="14.5" rx="1.5" /><path d="M4 10h16M9.5 10v9.5M15.5 10v9.5" /></>);

export const IconSliders = (p: P) =>
  base(p, <><path d="M5 6.5h9M17.5 6.5H19M5 12h3M11.5 12H19M5 17.5h11M19.5 17.5H19" /><circle cx="16" cy="6.5" r="1.8" /><circle cx="9.5" cy="12" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></>);

export const IconBook = (p: P) =>
  base(p, <><path d="M5 4.5h11A2.5 2.5 0 0 1 18.5 7v12.5H7A2 2 0 0 1 5 17.5z" /><path d="M5 17.5A2 2 0 0 1 7 15.5h11.5" /><path d="M9 8.5h5" /></>);

export const IconKey = (p: P) =>
  base(p, <><circle cx="8.5" cy="8.5" r="4" /><path d="M11.5 11.5L20 20M17 17l2-2M14.5 14.5l1.5-1.5" /></>);

export const IconCheck = (p: P) => base(p, <path d="M4.5 12.5l5 5 10-11" />);

export const IconX = (p: P) => base(p, <path d="M6 6l12 12M18 6L6 18" />);

export const IconPlus = (p: P) => base(p, <path d="M12 5v14M5 12h14" />);

export const IconTrash = (p: P) =>
  base(p, <><path d="M5 7h14M10 7V5h4v2M7 7l.8 12.5h8.4L17 7" /><path d="M10.2 10.5v6M13.8 10.5v6" /></>);

export const IconArrowR = (p: P) => base(p, <><path d="M4.5 12h15" /><path d="M13.5 6l6 6-6 6" /></>);

export const IconArrowL = (p: P) => base(p, <><path d="M19.5 12h-15" /><path d="M10.5 6l-6 6 6 6" /></>);

export const IconLink = (p: P) =>
  base(p, <><path d="M10 14a4 4 0 0 0 6 .4l2.6-2.6a4 4 0 1 0-5.7-5.7L11.5 7.5" /><path d="M14 10a4 4 0 0 0-6-.4l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.4-1.4" /></>);

export const IconMail = (p: P) =>
  base(p, <><rect x="4" y="6" width="16" height="13" rx="2" /><path d="M5 8l7 5.5L19 8" /></>);

export const IconDrive = (p: P) =>
  base(p, <><path d="M9.2 4.5h5.6l6 10.4-2.8 4.8H6L3.2 14.9z" /><path d="M9.2 4.5L3.2 14.9M14.8 4.5l6 10.4M6 19.7h12" /></>);

export const IconSheet = (p: P) =>
  base(p, <><rect x="4.5" y="4" width="15" height="16" rx="2" /><path d="M4.5 9.5h15M9.5 9.5V20M14.5 9.5V20" /></>);

export const IconAlert = (p: P) =>
  base(p, <><path d="M12 4L2.8 19.5h18.4z" /><path d="M12 10v4.5" /><circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none" /></>);

export const IconRefresh = (p: P) =>
  base(p, <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 3.5v4h-4" /></>);

export const IconSpark = (p: P) =>
  base(p, <><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" /><path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>);

export const IconCopy = (p: P) =>
  base(p, <><rect x="8.5" y="8.5" width="11" height="11" rx="1.5" /><path d="M5.5 15.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1" /></>);

export const IconEye = (p: P) =>
  base(p, <><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.5" /></>);

export const IconEyeOff = (p: P) =>
  base(p, <><path d="M5 5l14 14" /><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c5.5 0 9 7 9 7a16.4 16.4 0 0 1-3.2 4M6.1 8.3A15.6 15.6 0 0 0 3 12s3.5 7 9 7a9 9 0 0 0 3.4-.7" /></>);

export const IconExternal = (p: P) =>
  base(p, <><path d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v12A1.5 1.5 0 0 0 5.5 20h12a1.5 1.5 0 0 0 1.5-1.5V14" /><path d="M14 4h6v6" /><path d="M20 4l-9 9" /></>);

export const IconSpinner = (p: P) => {
  const { className = "", ...rest } = p;
  return base({ ...rest, className: `animate-spin ${className}` }, <path d="M12 3.5A8.5 8.5 0 1 1 3.5 12" />);
};

export const IconBriefcase = (p: P) =>
  base(p, <><rect x="4" y="7.5" width="16" height="12" rx="2" /><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" /><path d="M4 12.5h16" /></>);
