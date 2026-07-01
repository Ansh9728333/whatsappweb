import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names with Tailwind CSS conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Copies text to the clipboard and returns a success boolean.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for environments without clipboard API
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const success = document.execCommand("copy");
    document.body.removeChild(el);
    return success;
  }
}

/**
 * Formats a number string as a phone number display.
 */
export function formatPhoneNumber(number: string): string {
  return `+${number}`;
}

/**
 * Truncates a string to the given max length with ellipsis.
 */
export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}
