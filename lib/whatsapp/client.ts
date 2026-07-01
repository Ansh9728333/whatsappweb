import { prisma } from "@/lib/prisma";

const META_API_VERSION = process.env.META_API_VERSION ?? "v18.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaApiResponse<T = unknown> {
  data?: T;
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

async function metaRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  token?: string
): Promise<T> {
  const accessToken = token ?? process.env.META_SYSTEM_USER_TOKEN;
  if (!accessToken) {
    throw new Error("META_SYSTEM_USER_TOKEN is not configured");
  }

  const res = await fetch(`${META_BASE_URL}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as MetaApiResponse<T>;

  if (!res.ok || json.error) {
    throw new Error(
      json.error?.message ?? `Meta API error: ${res.status} ${res.statusText}`
    );
  }

  return json as T;
}

/**
 * Get customer's WhatsApp account with decrypted token.
 * Returns { phoneNumberId, accessToken } or null.
 */
export async function getCustomerWAConfig(
  customerId: string
): Promise<{ phoneNumberId: string; wabaId: string; accessToken: string } | null> {
  const account = await prisma.whatsAppAccount.findUnique({
    where: { customerId },
  });
  if (!account || account.status !== "CONNECTED") return null;

  // For demo: use system token. In production, decrypt customer's token.
  const accessToken =
    account.encryptedToken
      ? decryptToken(account.encryptedToken)
      : (process.env.META_SYSTEM_USER_TOKEN ?? "");

  return {
    phoneNumberId: account.phoneNumberId,
    wabaId: account.wabaId,
    accessToken,
  };
}

function decryptToken(encrypted: string): string {
  // Placeholder — in production use AES-256-GCM with ENCRYPTION_KEY env var
  return Buffer.from(encrypted, "base64").toString("utf-8");
}

export function encryptToken(raw: string): string {
  return Buffer.from(raw).toString("base64");
}

export { metaRequest };
