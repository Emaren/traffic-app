"use client";

export const TRAFFIC_SHARED_PROJECT_FILTER_KEY = "traffic.filters.projects";
export const TRAFFIC_LIVE_DENSITY_KEY = "traffic.live.density";
export const TRAFFIC_LIVE_GREEN_ONLY_KEY = "traffic.live.green-only";
export const TRAFFIC_HISTORY_CLASSIFICATION_KEY = "traffic.history.classification";

export function loadStoredString(key: string): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function storeString(key: string, value: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

export function loadStoredStringArray(key: string): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function storeStringArray(key: string, values: string[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {}
}

export function loadStoredBoolean(key: string, fallback = false): boolean {
  const raw = loadStoredString(key);
  if (!raw) return fallback;
  return raw === "1";
}

export function storeBoolean(key: string, value: boolean): void {
  storeString(key, value ? "1" : "0");
}

export function reconcileSelectedValues(
  selectedValues: string[],
  availableValues: string[],
): string[] {
  if (availableValues.length === 0) return [];

  const availableSet = new Set(availableValues);
  const next = selectedValues.filter((value) => availableSet.has(value));
  if (next.length > 0) {
    return next.length === selectedValues.length &&
      next.every((value, index) => value === selectedValues[index])
      ? selectedValues
      : next;
  }
  return [...availableValues];
}
