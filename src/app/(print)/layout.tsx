/**
 * The layout printable documents render inside.
 *
 * Deliberately bare. The dashboard shell is a fixed sidebar plus an `mr-64`
 * offset, which on paper becomes a blank column down the side of every page —
 * so a document meant to be printed is served outside that group rather than
 * fighting it with print overrides.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-muted/40 print:bg-white">
      {children}
    </div>
  );
}
