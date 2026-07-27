/**
 * Root loading fallback. There were previously zero loading.tsx files, so a
 * slow route rendered nothing at all while it resolved.
 */
export default function Loading() {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground">
          و
        </div>
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      </div>
    </main>
  );
}
