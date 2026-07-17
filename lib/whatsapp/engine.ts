const ENGINE_URL = process.env.WHATSAPP_ENGINE_URL || "http://localhost:3001";
const ENGINE_SECRET = process.env.WHATSAPP_ENGINE_SECRET || "super-engine-secret";

interface EngineResponse {
  sessionId: string;
  status: "pending" | "connected" | "disconnected" | "expired" | "failed";
  qrCode?: string | null;
  expiresAt?: string;
  phoneNumber?: string | null;
}

async function fetchEngine<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${ENGINE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  
  // Resolve dashboard URL dynamically to sync with the engine
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
  }
  try {
    const { headers: nextHeaders } = await import("next/headers");
    const headersList = await nextHeaders();
    const host = headersList.get("host");
    if (host) {
      const protocol = host.includes("localhost") ? "http" : "https";
      baseUrl = `${protocol}://${host}`;
    }
  } catch (e) {}

  const headers: HeadersInit = {
    "x-engine-secret": ENGINE_SECRET,
    "x-dashboard-url": baseUrl,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // Add cache: 'no-store' to prevent Vercel from caching dynamic status checks
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Engine API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json() as Promise<T>;
}

export async function startEngineSession(sessionId: string): Promise<EngineResponse> {
  return fetchEngine<EngineResponse>("POST", "/engine/sessions/start", { sessionId });
}

export async function getEngineSessionStatus(sessionId: string): Promise<EngineResponse> {
  return fetchEngine<EngineResponse>("GET", `/engine/sessions/${sessionId}/status`);
}

export async function disconnectEngineSession(sessionId: string): Promise<{ success: boolean }> {
  return fetchEngine<{ success: boolean }>("POST", `/engine/sessions/${sessionId}/disconnect`);
}

export async function restoreEngineSession(sessionId: string, credsData: string): Promise<any> {
  return fetchEngine<any>("POST", `/engine/sessions/${sessionId}/restore`, { data: credsData });
}

/**
 * Ensures the engine has the session active by loading credentials from PostgreSQL on-demand.
 * Returns true if the session is active or restored, false otherwise.
 */
export async function ensureEngineSessionActive(sessionId: string): Promise<boolean> {
  // We import prisma dynamically to avoid circular dependencies or initialization issues in client files
  const { prisma } = await import("@/lib/prisma");

  try {
    // 1. Check if the engine already has the session connected
    const statusRes = await getEngineSessionStatus(sessionId);
    if (statusRes.status === "connected") {
      return true;
    }
  } catch (err) {
    console.log(`[Engine Client] Session ${sessionId} not active in engine. Trying to restore from DB...`);
  }

  // 2. Fetch the credentials from the database
  const session = await prisma.whatsAppSession.findUnique({
    where: { sessionId },
  });

  if (!session || !session.data) {
    console.log(`[Engine Client] No credentials found in database for session ${sessionId}`);
    return false;
  }

  // 3. Push credentials to engine
  try {
    await restoreEngineSession(sessionId, session.data);
    
    // Wait a short moment for Baileys connection handshake (e.g. 2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Check status again
    const finalStatus = await getEngineSessionStatus(sessionId);
    return finalStatus.status === "connected";
  } catch (restoreErr: any) {
    console.error(`[Engine Client] Failed to restore session ${sessionId}:`, restoreErr.message);
    return false;
  }
}

export async function sendEngineMessage(
  sessionId: string,
  to: string,
  message: string,
  mediaUrl?: string,
  mediaType?: string
): Promise<{ success: boolean; messageId: string }> {
  // Automatically ensure the session is active in the engine before sending
  const isReady = await ensureEngineSessionActive(sessionId);
  if (!isReady) {
    throw new Error("WhatsApp account is not connected. Please go to the dashboard and reconnect.");
  }

  return fetchEngine<{ success: boolean; messageId: string }>("POST", `/engine/sessions/${sessionId}/send`, {
    to,
    message,
    mediaUrl,
    mediaType,
  });
}
