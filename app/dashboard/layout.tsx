import { requireAuth } from "@/lib/auth";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <DashboardShell isAdmin={session.role === "ADMIN"}>
      {children}
    </DashboardShell>
  );
}
