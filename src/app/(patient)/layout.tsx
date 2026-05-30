export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-secondary/30 relative pb-4">
      {/* Main Content Area */}
      <main className="max-w-md mx-auto min-h-screen bg-background shadow-sm overflow-hidden">
        {children}
      </main>
    </div>
  );
}
