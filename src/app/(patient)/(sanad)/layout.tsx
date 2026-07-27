export default function SanadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative pb-20">
      {children}
    </div>
  );
}
