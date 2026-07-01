"use client";

import { useState } from "react";
import { Copy, RefreshCw, BellOff, Trash2, Loader2 } from "lucide-react";
import { copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";

interface ActionButtonsProps {
  uniqueId: string;
  accountId: string;
  status: "Connected" | "Disconnected";
  onReconnect: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
}

interface TooltipButtonProps {
  tooltip: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: "default" | "danger";
}

function TooltipButton({
  tooltip,
  onClick,
  children,
  disabled,
  variant = "default",
}: TooltipButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200
          ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
          ${
            variant === "danger"
              ? "text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              : "text-teal-600 hover:text-teal-800 hover:bg-teal-50 dark:text-teal-400 dark:hover:text-teal-200 dark:hover:bg-teal-900/20"
          }
        `}
        style={{
          color: disabled ? undefined : variant === "danger" ? undefined : "#00635d",
        }}
      >
        {children}
      </button>

      {/* Tooltip */}
      {showTooltip && !disabled && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg">
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActionButtons({
  uniqueId,
  accountId,
  status,
  onReconnect,
  onDelete,
}: ActionButtonsProps) {
  const [reconnecting, setReconnecting] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(uniqueId);
    if (success) {
      toast.success("Copied!", {
        description: "Unique ID copied to clipboard.",
        duration: 2000,
      });
    } else {
      toast.error("Failed to copy");
    }
  };

  const handleReconnect = async () => {
    if (reconnecting) return;
    setReconnecting(true);
    try {
      await onReconnect(accountId);
      toast.success("Reconnected!", {
        description: "Account status updated to Connected.",
        duration: 3000,
      });
    } catch {
      toast.error("Reconnect failed", {
        description: "Please try again.",
      });
    } finally {
      setReconnecting(false);
    }
  };

  const handleMute = () => {
    toast.info("Incoming disabled", {
      description: "Notifications muted for this account.",
      duration: 2000,
    });
  };

  return (
    <div className="flex items-center gap-1">
      <TooltipButton tooltip="Copy Unique ID" onClick={handleCopy}>
        <Copy size={14} />
      </TooltipButton>

      <TooltipButton
        tooltip={reconnecting ? "Reconnecting..." : "Reconnect Account"}
        onClick={handleReconnect}
        disabled={reconnecting || status === "Connected"}
      >
        {reconnecting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <RefreshCw size={14} />
        )}
      </TooltipButton>

      <TooltipButton tooltip="Disable Incoming" onClick={handleMute}>
        <BellOff size={14} />
      </TooltipButton>

      <TooltipButton
        tooltip="Delete Account"
        onClick={() => onDelete(accountId)}
        variant="danger"
      >
        <Trash2 size={14} />
      </TooltipButton>
    </div>
  );
}
