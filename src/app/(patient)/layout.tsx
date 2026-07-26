import { BottomNavbar } from "@/components/shared/bottom-navbar";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-secondary/30 relative pb-16">
      {/* Main Content Area */}
      <main className="max-w-md mx-auto min-h-screen bg-background shadow-sm overflow-hidden">
        {children}
      </main>
      {/* Patient-only navigation — must not appear on /login or staff portals. */}
      <BottomNavbar />
    </div>
  );
}
