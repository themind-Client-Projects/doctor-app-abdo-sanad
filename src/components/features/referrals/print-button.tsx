"use client";

import { Printer } from "lucide-react";

/**
 * The only interactive part of a printed document.
 *
 * A client island rather than a client page: everything else on the sheet is
 * server-rendered, so the QR's SVG and the clinical body never reach the
 * browser as JavaScript.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 print:hidden"
    >
      <Printer size={16} aria-hidden="true" />
      طباعة
    </button>
  );
}
