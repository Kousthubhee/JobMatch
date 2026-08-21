/// <reference types="vite/client" />

// pdf.js worker entry — imported dynamically and attached to globalThis so
// pdf.js can run its main-thread fallback (no separate worker file needed).
declare module "pdfjs-dist/build/pdf.worker.min.mjs";
