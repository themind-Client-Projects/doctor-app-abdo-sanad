import { BottomNavbar } from '@/components/shared/bottom-navbar';

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-secondary/30 relative pb-20">
      {/* Main Content Area */}
      <main className="max-w-md mx-auto min-h-screen bg-background shadow-sm overflow-hidden">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="max-w-md mx-auto">
        <BottomNavbar />
      </div>
    </div>
  );
}
