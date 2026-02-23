import { useState, useCallback } from "react";
import type { ChatSession, SessionMessage } from "../types/session";

const SESSIONS_KEY = "thrifty:sessions";
const ACTIVE_KEY = "thrifty:active";
const MAX_SESSIONS = 20;

// ─── localStorage helpers ────────────────────────────────────────────────────

function readSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // Quota exceeded — silently ignore; sessions will persist in memory.
  }
}

function readActiveId(sessions: ChatSession[]): string | null {
  try {
    const id = localStorage.getItem(ACTIVE_KEY);
    if (id && sessions.some((s) => s.id === id)) return id;
  } catch {
    /* ignore */
  }
  return sessions[0]?.id ?? null;
}

function writeActiveId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function deriveTitle(messages: SessionMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New conversation";
  const text = first.content.trim();
  return text.length > 44 ? text.slice(0, 42) + "…" : text;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseChatSessionsReturn {
  sessions: ChatSession[];
  activeId: string | null;
  activeSession: ChatSession | null;
  newSession: () => string;
  saveSession: (
    messages: SessionMessage[],
    priceHistoryRoute?: { departure: string; arrival: string } | null,
    sessionIdOverride?: string,
  ) => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
}

export function useChatSessions(): UseChatSessionsReturn {
  const [sessions, setSessions] = useState<ChatSession[]>(() => readSessions());
  const [activeId, setActiveId] = useState<string | null>(() =>
    readActiveId(readSessions()),
  );

  // Resolve a valid activeId during render instead of via an effect.
  // If the stored activeId is no longer in sessions (deleted or corrupted storage)
  // fall back to the first remaining session — no extra render triggered.
  const resolvedActiveId =
    activeId != null && sessions.some((s) => s.id === activeId)
      ? activeId
      : (sessions[0]?.id ?? null);

  const activeSession = sessions.find((s) => s.id === resolvedActiveId) ?? null;

  // ── Create a new blank session and make it active ─────────────────────────
  const newSession = useCallback((): string => {
    const id = generateId();
    const session: ChatSession = {
      id,
      title: "New conversation",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      priceHistoryRoute: null,
    };
    setSessions((prev) => {
      const next = [session, ...prev].slice(0, MAX_SESSIONS);
      writeSessions(next);
      return next;
    });
    setActiveId(id);
    writeActiveId(id);
    return id;
  }, []);

  // ── Persist the current session's messages + route ────────────────────────
  const saveSession = useCallback(
    (
      messages: SessionMessage[],
      priceHistoryRoute?: { departure: string; arrival: string } | null,
      sessionIdOverride?: string,
    ) => {
      const targetId = sessionIdOverride ?? resolvedActiveId;
      if (!targetId) return;
      setSessions((prev) => {
        const next = prev.map((s) =>
          s.id === targetId
            ? {
                ...s,
                title: deriveTitle(messages),
                messages,
                priceHistoryRoute:
                  priceHistoryRoute !== undefined
                    ? priceHistoryRoute
                    : s.priceHistoryRoute,
                updatedAt: new Date().toISOString(),
              }
            : s,
        );
        writeSessions(next);
        return next;
      });
    },
    [resolvedActiveId],
  );

  // ── Switch to a different session ─────────────────────────────────────────
  const switchSession = useCallback((id: string) => {
    setActiveId(id);
    writeActiveId(id);
  }, []);

  // ── Delete a session ──────────────────────────────────────────────────────
  const deleteSession = useCallback(
    (id: string) => {
      const nextSessions = sessions.filter((s) => s.id !== id);
      writeSessions(nextSessions);
      setSessions(nextSessions);

      if (resolvedActiveId === id) {
        const fallback = nextSessions[0]?.id ?? null;
        setActiveId(fallback);
        try {
          if (fallback) localStorage.setItem(ACTIVE_KEY, fallback);
          else localStorage.removeItem(ACTIVE_KEY);
        } catch {
          /* ignore */
        }
      }
    },
    [sessions, resolvedActiveId],
  );

  return {
    sessions,
    activeId: resolvedActiveId,
    activeSession,
    newSession,
    saveSession,
    switchSession,
    deleteSession,
  };
}
