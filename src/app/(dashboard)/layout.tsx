"use client";

import { SessionProvider } from "next-auth/react";
import type { UserRole } from "@/types/dashboard";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { useRole } from "@/hooks/use-role";

// Hoisted: static config does not belong in the render body.
const ENTITY_NAMES: Record<UserRole, string> = {
  DOCTOR: "عيادة طبية",
  LAB: "مختبر طبي",
  PHARMACY: "صيدلية",
  NURSE: "خدمات تمريض",
  DRIVER: "خدمات توصيل",
  RADIOLOGY: "مركز أشعة",
  SUPER_ADMIN: "إدارة وريد",
  OPERATIONS: "عمليات وريد",
  PATIENT: "وريد",
};

/**
 * Where the header's search box sends a query, per role.
 *
 * "مرضاي" is the only list a partner holds that is worth searching from the
 * chrome, and a DRIVER does not have one — their work is trips, and a driver
 * is deliberately outside clinical scope everywhere else in the app. A role
 * with no entry gets no search box rather than one that leads nowhere.
 */
const SEARCH_HREF: Partial<Record<UserRole, string>> = {
  DOCTOR: "/dashboard/patients",
  LAB: "/dashboard/patients",
  PHARMACY: "/dashboard/patients",
  NURSE: "/dashboard/patients",
  RADIOLOGY: "/dashboard/patients",
};

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { role, userName, isLoading } = useRole();

  const entityName = role ? ENTITY_NAMES[role] : "وريد";

  // No resolved role means the session is missing or expired. Middleware will
  // redirect, but the shell must not render staff chrome in the meantime.
  if (isLoading || !role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-2xl animate-pulse">
            و
          </div>
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <DashboardSidebar
        role={role}
        userName={userName}
        entityName={entityName}
      />
      {/* Main content area — offset by sidebar width */}
      <div className="mr-64 min-h-screen flex flex-col">
        <DashboardHeader
          entityName={entityName}
          userName={userName}
          searchHref={SEARCH_HREF[role]}
        />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <DashboardShell>{children}</DashboardShell>
    </SessionProvider>
  );
}
