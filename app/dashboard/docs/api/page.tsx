import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { headers } from "next/headers";
import { BookOpen, Key, Send, Terminal, CheckCircle2, FileText, Database, ShieldCheck } from "lucide-react";

export const metadata = { title: "API Documentation — Whatsify" };

export default async function ApiDocsPage() {
  const session = await requireAuth();

  const apiKey = session.customerId
    ? await prisma.apiKey.findFirst({
        where: { customerId: session.customerId, isActive: true },
        select: { keyPreview: true, secretPreview: true },
      })
    : null;

  const headersList = await headers();
  const host = headersList.get("host") || "whatsappweb-one.vercel.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const liveKey = apiKey ? apiKey.keyPreview : "wf_live_your_api_key_here";
  const liveSecret = apiKey && apiKey.secretPreview ? apiKey.secretPreview : "wf_sec_your_secret_key_here";

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen size={24} className="text-emerald-500" /> API & Sheet Automation
        </h1>
        <p className="text-slate-500 mt-1">
          Integrate Whatsify WhatsApp delivery into your custom apps or link it to Google Sheets for bulk messaging.
        </p>
      </div>

      {/* Authentication Info */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Key size={18} className="text-emerald-500" /> Authentication
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          All API requests must be authenticated using your API Key and Secret. You can manage credentials in the{" "}
          <Link href="/dashboard/api-keys" className="text-emerald-500 font-semibold hover:underline">
            API Keys
          </Link>{" "}
          page.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-400">API Key Header</span>
            <div className="bg-slate-900 rounded-xl p-3.5 font-mono text-xs text-slate-300 overflow-x-auto">
              Authorization: Bearer {liveKey}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-400">API Secret Header</span>
            <div className="bg-slate-900 rounded-xl p-3.5 font-mono text-xs text-slate-300 overflow-x-auto">
              X-API-Secret: {liveSecret}
            </div>
          </div>
        </div>
      </section>

      {/* Send message endpoint */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Terminal size={18} className="text-emerald-500" /> API Reference
        </h2>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-emerald-500 text-white font-bold text-xs px-2.5 py-1 rounded-md">POST</span>
            <code className="text-sm font-semibold text-slate-800 dark:text-slate-200">/api/v1/messages/send</code>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Send outbound text messages, media attachments (images, PDFs, documents, videos, audio), or template messages.
          </p>

          <h3 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Request Parameters</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs font-semibold text-slate-500">
                  <th className="pb-2 pr-4">Field</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Required</th>
                  <th className="pb-2">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                <tr>
                  <td className="py-2.5 font-mono text-xs font-semibold pr-4">to</td>
                  <td className="py-2.5 text-xs text-slate-500 pr-4">string</td>
                  <td className="py-2.5 text-xs text-red-500 font-semibold pr-4">Yes</td>
                  <td className="py-2.5 text-xs text-slate-600 dark:text-slate-400">Recipient number with country code (e.g. &quot;919876543210&quot;). No plus signs.</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-mono text-xs font-semibold pr-4">type</td>
                  <td className="py-2.5 text-xs text-slate-500 pr-4">string</td>
                  <td className="py-2.5 text-xs text-slate-400 pr-4">No</td>
                  <td className="py-2.5 text-xs text-slate-600 dark:text-slate-400">Set as &quot;text&quot;, &quot;image&quot;, &quot;document&quot;, &quot;video&quot;, or &quot;audio&quot;. Defaults to text.</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-mono text-xs font-semibold pr-4">message</td>
                  <td className="py-2.5 text-xs text-slate-500 pr-4">string</td>
                  <td className="py-2.5 text-xs text-slate-400 pr-4">No</td>
                  <td className="py-2.5 text-xs text-slate-600 dark:text-slate-400">Text content of the message or caption.</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-mono text-xs font-semibold pr-4">mediaUrl</td>
                  <td className="py-2.5 text-xs text-slate-500 pr-4">string</td>
                  <td className="py-2.5 text-xs text-slate-400 pr-4">No</td>
                  <td className="py-2.5 text-xs text-slate-600 dark:text-slate-400">Public URL of your attachment. Supports Google Drive files, images, PDFs, etc. Mimetypes are auto-resolved!</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold text-xs text-slate-400 uppercase tracking-wider pt-2">Example CURL (Media Message)</h3>
          <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre">
{`curl -X POST ${baseUrl}/api/v1/messages/send \\
  -H "Authorization: Bearer ${liveKey}" \\
  -H "X-API-Secret: ${liveSecret}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "919876543210",
    "type": "image",
    "message": "Check out this document!",
    "mediaUrl": "https://example.com/invoice.pdf"
  }'`}
          </div>
        </div>
      </section>

      {/* Google Sheets Automation Section */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Database size={18} className="text-emerald-500" /> Google Sheets Automation
        </h2>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-4 shadow-sm">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">1. Setup Google Sheet Columns</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Create a Google Sheet with the following 4 columns exactly:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-400 block font-semibold">Column A</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Mobile Number</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-400 block font-semibold">Column B</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Attachment URL</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-400 block font-semibold">Column C</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Message</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-400 block font-semibold">Column D</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Status</span>
            </div>
          </div>

          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 pt-2">2. Add Apps Script Code</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Go to <strong>Extensions &gt; Apps Script</strong>, remove all default code, and paste the code snippet below.
          </p>

          <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre max-h-96">
{`// ==========================================
// CONFIGURATION
// ==========================================
const API_KEY = "${liveKey}";
const API_SECRET = "${liveSecret}";
const DASHBOARD_URL = "${baseUrl}";

function sendBulkWhatsAppWebMessages() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  const phoneCol = 0;
  const attachmentCol = 1;
  const messageCol = 2;
  const statusCol = 3;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const phone = row[phoneCol].toString().trim();
    const attachmentUrl = row[attachmentCol].toString().trim();
    const message = row[messageCol].toString().trim();
    const currentStatus = row[statusCol].toString().trim();
    
    // Process only if status is empty, "pending", or "failed"
    if (phone && (currentStatus === "" || currentStatus.toLowerCase() === "pending" || currentStatus.toLowerCase() === "failed")) {
      const statusCell = sheet.getRange(i + 1, statusCol + 1);
      
      try {
        const url = \`\${DASHBOARD_URL}/api/v1/messages/send\`;
        const directUrl = convertToDirectDownloadUrl(attachmentUrl);
        
        const payload = {
          "to": phone,
          "message": message,
          "type": "text"
        };
        
        if (directUrl) {
          payload.mediaUrl = directUrl;
          
          // Ext detection for default mapping (engine headers override this anyway)
          const ext = directUrl.split('.').pop().toLowerCase().split('?')[0];
          if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
            payload.type = "image";
          } else if (["mp4", "3gp", "m4v", "mov"].includes(ext)) {
            payload.type = "video";
          } else if (["mp3", "ogg", "wav", "m4a"].includes(ext)) {
            payload.type = "audio";
          } else {
            payload.type = "document";
          }
        }
        
        const options = {
          "method": "post",
          "contentType": "application/json",
          "headers": {
            "Authorization": "Bearer " + API_KEY,
            "X-API-Secret": API_SECRET
          },
          "payload": JSON.stringify(payload),
          "muteHttpExceptions": true
        };
        
        const response = UrlFetchApp.fetch(url, options);
        const resData = JSON.parse(response.getContentText());
        
        if (response.getResponseCode() == 200 && resData.success) {
          statusCell.setValue("Sent");
          statusCell.setBackground("#D4EDDA");
        } else {
          statusCell.setValue("Failed: " + (resData.error || response.getContentText()));
          statusCell.setBackground("#F8D7DA");
        }
      } catch (error) {
        statusCell.setValue("Error: " + error.toString());
        statusCell.setBackground("#F8D7DA");
      }
      
      Utilities.sleep(1500); // anti-ban delay
    }
  }
}

// Convert Google Drive view links to direct downloadable URLs automatically
function convertToDirectDownloadUrl(url) {
  if (!url) return "";
  if (url.includes("drive.google.com")) {
    const match = url.match(/\\/d\\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return \`https://docs.google.com/uc?export=download&id=\${match[1]}\`;
    }
  }
  return url;
}`}
          </div>
        </div>
      </section>
    </div>
  );
}
