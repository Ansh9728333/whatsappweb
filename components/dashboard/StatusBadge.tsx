import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "Connected" | "Disconnected";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const isConnected = status === "Connected";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide",
        isConnected
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      )}
    >
      {isConnected ? (
        <CheckCircle2 size={11} className="flex-shrink-0" />
      ) : (
        <XCircle size={11} className="flex-shrink-0" />
      )}
      {status}
    </span>
  );
}
