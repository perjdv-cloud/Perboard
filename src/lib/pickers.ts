"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Custom account & category lists for the Finance tab.
 * Persisted to localStorage so user-added accounts/categories survive reloads,
 * and kept in sync across components via a custom window event.
 */

const ACCOUNTS_KEY = "finance.accounts.v1";
const CATEGORIES_KEY = "finance.categories.v1";
const CHANGE_EVENT = "finance-pickers-change";

export const DEFAULT_ACCOUNTS = ["Cash", "Bank", "Card", "UPI", "Other"];
export const DEFAULT_CATEGORIES = [
  "Salary",
  "Food",
  "Rent",
  "Shopping",
  "Transport",
  "General",
  "Other",
];

function readList(key: string, defaults: string[]): string[] {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaults;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.every((x) => typeof x === "string")) {
      return defaults;
    }
    return arr;
  } catch {
    return defaults;
  }
}

function writeList(key: string, value: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    /* ignore quota errors */
  }
}

// Cache the last-read list per key so getSnapshot returns a stable reference
// until the value actually changes (avoids infinite re-render loops).
const cache = new Map<string, string[]>();

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(key: string, defaults: string[]): string[] {
  const next = readList(key, defaults);
  const prev = cache.get(key);
  if (
    prev &&
    prev.length === next.length &&
    prev.every((v, i) => v === next[i])
  ) {
    return prev;
  }
  cache.set(key, next);
  return next;
}

function getServerSnapshot(defaults: string[]): string[] {
  return defaults;
}

function usePickers(key: string, defaults: string[]) {
  const items = useSyncExternalStore(
    subscribe,
    () => getSnapshot(key, defaults),
    () => getServerSnapshot(defaults)
  );

  const add = useCallback(
    (name: string) => {
      const n = name.trim();
      if (!n) return false;
      const current = readList(key, defaults);
      if (current.some((x) => x.toLowerCase() === n.toLowerCase())) {
        return false;
      }
      writeList(key, [...current, n]);
      return true;
    },
    [key, defaults]
  );

  const remove = useCallback(
    (name: string) => {
      const current = readList(key, defaults);
      writeList(key, current.filter((x) => x !== name));
    },
    [key, defaults]
  );

  return { items, add, remove };
}

export function useAccounts() {
  const { items, add, remove } = usePickers(ACCOUNTS_KEY, DEFAULT_ACCOUNTS);
  return { accounts: items, addAccount: add, removeAccount: remove };
}

export function useCategories() {
  const { items, add, remove } = usePickers(CATEGORIES_KEY, DEFAULT_CATEGORIES);
  return { categories: items, addCategory: add, removeCategory: remove };
}
