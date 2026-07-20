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
 * If the provided sessionId is not active, it attempts to find and restore any ACTIVE session for the account.
 * Returns the active sessionId string if ready, or null if unrecoverable.
 */
export async function ensureEngineSessionActive(sessionId: string): Promise<string | null> {
  const { prisma } = await import("@/lib/prisma");

  // 1. Check if the engine already has the provided session connected
  try {
    const statusRes = await getEngineSessionStatus(sessionId);
    if (statusRes.status === "connected") {
      return sessionId;
    }
  } catch (err) {
    console.log(`[Engine Client] Session ${sessionId} not active in engine. Attempting restore...`);
  }

  // 2. Fetch the credentials for this specific sessionId from DB
  let session = await prisma.whatsAppSession.findUnique({
    where: { sessionId },
  });

  // 3. Fallback: If no credentials exist for this sessionId (e.g. engineSessionId was overwritten during a link init),
  // search for ANY active session under the same WhatsApp account
  if (!session || !session.data || session.status !== "ACTIVE") {
    console.log(`[Engine Client] No active credentials for ${sessionId}. Searching for alternative active sessions...`);
    
    // Find WhatsApp account associated with this sessionId or customer
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        OR: [
          { engineSessionId: sessionId },
          { sessions: { some: { sessionId } } },
        ],
      },
    });

    if (account) {
      const activeSession = await prisma.whatsAppSession.findFirst({
        where: { whatsappAccountId: account.id, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
      });

      if (activeSession && activeSession.data) {
        session = activeSession;
        console.log(`[Engine Client] Found alternative active session ${activeSession.sessionId} for account ${account.id}`);

        // Self-heal account's engineSessionId reference
        await prisma.whatsAppAccount.update({
          where: { id: account.id },
          data: { engineSessionId: activeSession.sessionId, status: "CONNECTED" },
        }).catch(() => {});
      }
    }
  }

  if (!session || !session.data) {
    console.log(`[Engine Client] No valid credentials found in database for session ${sessionId}`);
    return null;
  }

  // 4. Push credentials to engine
  const targetSessionId = session.sessionId;
  try {
    await restoreEngineSession(targetSessionId, session.data);
    
    // Wait a short moment for Baileys connection handshake
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Check status again
    const finalStatus = await getEngineSessionStatus(targetSessionId);
    if (finalStatus.status === "connected") {
      return targetSessionId;
    }
  } catch (restoreErr: any) {
    console.error(`[Engine Client] Failed to restore session ${targetSessionId}:`, restoreErr.message);
  }

  return null;
}

export async function sendEngineMessage(
  sessionId: string,
  to: string,
  message: string,
  mediaUrl?: string,
  mediaType?: string
): Promise<{ success: boolean; messageId: string }> {
  // Automatically ensure the session is active in the engine before sending
  const activeSessionId = await ensureEngineSessionActive(sessionId);
  if (!activeSessionId) {
    throw new Error("WhatsApp account is not connected. Please go to the dashboard and reconnect.");
  }

  return fetchEngine<{ success: boolean; messageId: string }>("POST", `/engine/sessions/${activeSessionId}/send`, {
    to,
    message,
    mediaUrl,
    mediaType,
  });
}
