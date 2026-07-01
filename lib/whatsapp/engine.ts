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
  
  const headers: HeadersInit = {
    "x-engine-secret": ENGINE_SECRET,
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

export async function sendEngineMessage(
  sessionId: string,
  to: string,
  message: string
): Promise<{ success: boolean; messageId: string }> {
  return fetchEngine<{ success: boolean; messageId: string }>("POST", `/engine/sessions/${sessionId}/send`, {
    to,
    message,
  });
}
