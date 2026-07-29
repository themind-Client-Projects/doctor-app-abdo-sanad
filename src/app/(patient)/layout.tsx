import { BottomNavbar } from "@/components/shared/bottom-navbar";
import { ForceLight } from "@/components/force-light";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-secondary/30 relative pb-16">
      {/* Patient screens are light-only by design — see the component. */}
      <ForceLight />
      {/* Main Content Area */}
      <main className="max-w-md mx-auto min-h-screen bg-background shadow-sm overflow-hidden">
        {children}
      </main>
      {/* Patient-only navigation — must not appear on /login or staff portals. */}
      <BottomNavbar />
    </div>
  );
}
