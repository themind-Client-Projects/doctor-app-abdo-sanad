import { BottomNavbar } from '@/components/shared/bottom-navbar';

export default function SanadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative pb-20">
      {children}
      {/* Mobile Bottom Navigation */}
      <div className="max-w-md mx-auto">
        <BottomNavbar />
      </div>
    </div>
  );
}
