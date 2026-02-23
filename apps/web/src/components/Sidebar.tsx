import type { ChatSession } from "../types/session";

interface SidebarProps {
  sessions: ChatSession[];
  activeId: string | null;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function relativeLabel(isoString: string): string {
  const date = new Date(isoString);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Sidebar({ sessions, activeId, onNew, onSwitch, onDelete, onClose }: SidebarProps) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <aside
      className="w-[240px] shrink-0 flex flex-col bg-[#0c0c10] border-r border-app-border h-screen sticky top-0 overflow-y-auto z-20 max-[680px]:fixed max-[680px]:left-0 max-[680px]:top-0 max-[680px]:bottom-0 max-[680px]:h-full max-[680px]:z-50 max-[680px]:shadow-[4px_0_24px_rgba(0,0,0,0.5)]"
      aria-label="Chat history"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-[0.85rem] border-b border-app-border shrink-0">
        <button
          type="button"
          className="flex-1 flex items-center gap-[0.45rem] px-[0.7rem] py-2 text-[0.82rem] font-semibold text-app-text bg-app-surface border border-app-border rounded-lg cursor-pointer transition-all whitespace-nowrap hover:bg-app-accent/15 hover:border-app-accent hover:text-app-accent"
          onClick={onNew}
          title="New conversation"
        >
          <PlusIcon />
          New chat
        </button>
        <button
          type="button"
          className="shrink-0 flex items-center justify-center w-[30px] h-[30px] bg-transparent border-none rounded-md text-app-text-muted cursor-pointer transition-colors hover:bg-app-border hover:text-app-text"
          onClick={onClose}
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          <ChevronLeftIcon />
        </button>
      </div>

      {/* Session list */}
      <nav className="flex-1 py-2 overflow-y-auto" aria-label="Previous conversations">
        {sorted.length === 0 ? (
          <p className="text-[0.8rem] text-app-text-subtle px-[0.85rem] py-4 m-0">
            No conversations yet.
          </p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-px">
            {sorted.map((session) => (
              <li key={session.id} className="relative flex items-stretch group">
                <button
                  type="button"
                  className={`flex-1 min-w-0 flex flex-col items-start gap-[0.15rem] py-[0.6rem] pl-[0.85rem] pr-9 text-left border-none rounded-none cursor-pointer transition-colors ${
                    session.id === activeId
                      ? "bg-app-accent/15"
                      : "bg-transparent hover:bg-white/[0.04]"
                  }`}
                  onClick={() => onSwitch(session.id)}
                  title={session.title}
                >
                  <span
                    className={`text-[0.8rem] font-medium truncate max-w-full ${
                      session.id === activeId ? "text-app-accent" : "text-app-text"
                    }`}
                  >
                    {session.title}
                  </span>
                  <span className="text-[0.7rem] text-app-text-subtle">
                    {relativeLabel(session.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  className="absolute right-[0.4rem] top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-[5px] border-none bg-transparent text-app-text-subtle cursor-pointer opacity-0 group-hover:opacity-100 transition-all hover:bg-app-red/15 hover:text-app-red hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
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

function PlusIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
