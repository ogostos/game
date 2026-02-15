const SESSION_STORAGE_KEY = "imposter-party-session";

function fallbackSessionId() {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const nextId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : fallbackSessionId();

  window.localStorage.setItem(SESSION_STORAGE_KEY, nextId);
  return nextId;
}
