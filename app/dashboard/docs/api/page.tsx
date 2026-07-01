import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { BookOpen, Key, Send, Terminal, CheckCircle2 } from "lucide-react";

export const metadata = { title: "API Documentation — Whatsify" };

export default async function ApiDocsPage() {
  const session = await requireAuth();

  const apiKey = session.customerId
    ? await prisma.apiKey.findFirst({
        where: { customerId: session.customerId, isActive: true },
        select: { keyPrefix: true },
      })
    : null;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen size={24} className="text-emerald-500" /> Whatsify Platform API Docs
        </h1>
        <p className="text-slate-500 mt-1">
          Integrate WhatsApp messaging into your own applications using our developer-friendly REST API.
        </p>
      </div>

      {/* Authentication Info */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Key size={18} className="text-emerald-500" /> Authentication
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          All API requests must be authenticated using a Bearer token in the `Authorization` header. You can generate tokens in the{" "}
          <Link href="/dashboard/api-keys" className="text-emerald-500 font-semibold hover:underline">
            API Keys
          </Link>{" "}
          page.
        </p>
        <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto">
          Authorization: Bearer {apiKey ? `${apiKey.keyPrefix}••••••••••••••••` : "wf_live_your_api_key_here"}
        </div>
      </section>

      {/* Endpoints */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Terminal size={18} className="text-emerald-500" /> Endpoints
        </h2>

        {/* Send message */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-emerald-500 text-white font-bold text-xs px-2.5 py-1 rounded-md">POST</span>
            <code className="text-sm font-semibold text-slate-800 dark:text-slate-200">/api/v1/messages/send</code>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Send a text message or approved template message to a contact.
          </p>

          <h3 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Request Body Parameters</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs font-semibold text-slate-500">
                <th className="pb-2">Field</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Required</th>
                <th className="pb-2">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              <tr>
                <td className="py-2.5 font-mono text-xs font-semibold">to</td>
                <td className="py-2.5 text-xs text-slate-500">string</td>
                <td className="py-2.5 text-xs text-red-500 font-semibold">Yes</td>
                <td className="py-2.5 text-xs text-slate-600 dark:text-slate-400">Recipient phone number with country code (e.g. &quot;919876543210&quot;).</td>
              </tr>
              <tr>
                <td className="py-2.5 font-mono text-xs font-semibold">type</td>
                <td className="py-2.5 text-xs text-slate-500">string</td>
                <td className="py-2.5 text-xs text-red-500 font-semibold">Yes</td>
                <td className="py-2.5 text-xs text-slate-600 dark:text-slate-400">Must be either &quot;text&quot; or &quot;template&quot;.</td>
              </tr>
              <tr>
                <td className="py-2.5 font-mono text-xs font-semibold">text</td>
                <td className="py-2.5 text-xs text-slate-500">string</td>
                <td className="py-2.5 text-xs text-slate-400">Conditional</td>
                <td className="py-2.5 text-xs text-slate-600 dark:text-slate-400">Required if type is &quot;text&quot;. Text message body.</td>
              </tr>
              <tr>
                <td className="py-2.5 font-mono text-xs font-semibold">template_name</td>
                <td className="py-2.5 text-xs text-slate-500">string</td>
                <td className="py-2.5 text-xs text-slate-400">Conditional</td>
                <td className="py-2.5 text-xs text-slate-600 dark:text-slate-400">Required if type is &quot;template&quot;. Approved template name.</td>
              </tr>
              <tr>
                <td className="py-2.5 font-mono text-xs font-semibold">language</td>
                <td className="py-2.5 text-xs text-slate-500">string</td>
                <td className="py-2.5 text-xs text-slate-400">No</td>
                <td className="py-2.5 text-xs text-slate-600 dark:text-slate-400">Template language code. Defaults to &quot;en_US&quot;.</td>
              </tr>
              <tr>
                <td className="py-2.5 font-mono text-xs font-semibold">variables</td>
                <td className="py-2.5 text-xs text-slate-500">object</td>
                <td className="py-2.5 text-xs text-slate-400">No</td>
                <td className="py-2.5 text-xs text-slate-600 dark:text-slate-400">Map of variable index to values for templates (e.g. `{`{"1": "John", "2": "Order #1"}`}`).</td>
              </tr>
            </tbody>
          </table>

          <h3 className="font-semibold text-xs text-slate-400 uppercase tracking-wider pt-2">Example CURL</h3>
          <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre">
{`curl -X POST https://api.whatsify.io/api/v1/messages/send \\
  -H "Authorization: Bearer ${apiKey ? `${apiKey.keyPrefix}••••••••` : "YOUR_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "919876543210",
    "type": "text",
    "text": "Hello from Whatsify API!"
  }'`}
          </div>

          <h3 className="font-semibold text-xs text-slate-400 uppercase tracking-wider pt-2">Example Response</h3>
          <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre">
{`{
  "messageId": "msg_8d8b8c2a11b8",
  "metaMessageId": "wamid.HBgLOTE5ODc2NTQzMjEwFQIAERg5MUQwQTFCNDNDRUQ4OEIwMTMA",
  "status": "SENT"
}`}
          </div>
        </div>
      </section>
    </div>
  );
}
