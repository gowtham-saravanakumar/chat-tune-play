function ChatIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function GameIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

function BoardIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}

const TABS = [
  { id: "chat", label: "Chat", Icon: ChatIcon, hideOnDesktop: true },
  { id: "game", label: "XOXO", Icon: GameIcon },
  { id: "board", label: "Board", Icon: BoardIcon },
];

export default function Tabs({ active, onChange, unread }) {
  return (
    <nav className="flex bg-elevated border-t border-border sm:border-t-0 sm:border-b sm:border-r-0 order-last sm:order-none">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          aria-label={t.label}
          aria-current={active === t.id ? "true" : undefined}
          className={`relative flex-1 sm:flex-none flex flex-col sm:flex-row items-center gap-1 sm:gap-2 justify-center px-3 py-2.5 sm:py-2 sm:px-4 text-xs sm:text-sm font-medium transition-colors ${
            t.hideOnDesktop ? "lg:hidden" : ""
          } ${active === t.id ? "text-warm" : "text-muted hover:text-ptext"}`}
        >
          <t.Icon />
          <span>{t.label}</span>
          {unread?.[t.id] > 0 && active !== t.id && (
            <span className="absolute top-1 right-4 sm:relative sm:top-0 sm:right-0 w-1.5 h-1.5 rounded-full bg-warm" />
          )}
        </button>
      ))}
    </nav>
  );
}
