import Credits from "./Credits";

export default function PresenceBar({ users, selfId, roomCode, onCopyLink, linkCopied }) {
  const self = users.find((u) => u.id === selfId);
  const other = users.find((u) => u.id !== selfId);

  return (
    <div className="bg-elevated border-b border-border">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar user={self} online />
          <div className="relative w-10 h-[2px] rounded-full overflow-hidden bg-border">
            {other && (
              <div className="absolute inset-0 bg-gradient-to-r from-warm to-cool animate-pulseline" />
            )}
          </div>
          <Avatar user={other} online={!!other} placeholder="Waiting for them…" />
        </div>

        <button
          onClick={onCopyLink}
          aria-label={linkCopied ? "Link copied to clipboard" : "Copy room link"}
          className={`text-xs font-mono border rounded-lg px-3 py-1.5 shrink-0 transition-colors ${
            linkCopied ? "bg-coolsoft border-cool text-cool" : "bg-card border-border text-muted hover:text-ptext hover:border-warm"
          }`}
        >
          {linkCopied ? "Copied!" : `${roomCode} · copy link`}
        </button>
      </div>
      <div className="px-4 pb-2">
        <Credits compact />
      </div>
    </div>
  );
}

function Avatar({ user, online, placeholder }) {
  if (!user) {
    return (
      <div className="flex items-center gap-2 opacity-50">
        <div className="w-8 h-8 rounded-full border border-dashed border-muted flex items-center justify-center text-sm text-muted">
          ?
        </div>
        {placeholder && <span className="text-xs text-muted hidden sm:inline">{placeholder}</span>}
      </div>
    );
  }
  const initial = (user.name || "?").trim().charAt(0).toUpperCase();
  const bg = user.avatar && user.avatar.startsWith("#") ? user.avatar : "#1A73E8";
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
          style={{ backgroundColor: bg }}
        >
          {initial}
        </div>
        {online && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-elevated" />
        )}
      </div>
      <span className="text-sm font-medium hidden sm:inline text-ptext">{user.name}</span>
    </div>
  );
}
