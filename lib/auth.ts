import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/lib/session";

export type { SessionPayload };

export async function requireAuth(
  role?: "ADMIN" | "CUSTOMER"
): Promise<SessionPayload> {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (role && session.role !== role) {
    // Customer trying to access admin, or mismatch — redirect to their dashboard
    redirect("/dashboard");
  }

  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  return requireAuth("ADMIN");
}

export async function getOptionalSession(): Promise<SessionPayload | null> {
  return getSession();
}
