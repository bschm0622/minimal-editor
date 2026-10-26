import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent)

/** Shortcut labels: "⌘K" and "⌥D" on a Mac, "Ctrl+K" and "Alt+D" elsewhere. */
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl+"
export const ALT_KEY = IS_MAC ? "⌥" : "Alt+"
