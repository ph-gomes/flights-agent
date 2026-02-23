import type { ChatSession } from "../types/session";

interface SidebarProps {
  sessions: ChatSession[];
  activeId: string | null;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// ─── Date label helpers ──────────────────────────────────────────────────────

function relativeLabel(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Sidebar({
  sessions,
  activeId,
  onNew,
  onSwitch,
  onDelete,
  onClose,
}: SidebarProps) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <aside className="sidebar" aria-label="Chat history">
      {/* Header */}
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-new-btn"
          onClick={onNew}
          title="New conversation"
        >
          <PlusIcon />
          New chat
        </button>
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          <ChevronLeftIcon />
        </button>
      </div>

      {/* Session list */}
      <nav className="sidebar-nav" aria-label="Previous conversations">
        {sorted.length === 0 ? (
          <p className="sidebar-empty">No conversations yet.</p>
        ) : (
          <ul className="sidebar-list">
            {sorted.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className={`sidebar-item ${session.id === activeId ? "sidebar-item-active" : ""}`}
                  onClick={() => onSwitch(session.id)}
                  title={session.title}
                >
                  <span className="sidebar-item-title">{session.title}</span>
                  <span className="sidebar-item-date">
                    {relativeLabel(session.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  className="sidebar-item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(session.id);
                  }}
                  aria-label={`Delete "${session.title}"`}
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
