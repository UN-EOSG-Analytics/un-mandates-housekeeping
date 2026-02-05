import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getISOTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/:/g, "-");
}

export function abbreviateBody(
  body: string | null,
  abbreviations: Record<string, string>,
): string | null {
  if (!body) return null;
  return abbreviations[body] ?? body;
}
