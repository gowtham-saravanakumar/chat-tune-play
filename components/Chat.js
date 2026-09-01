import { useEffect, useRef, useState } from "react";

const TYPING_IDLE_MS = 2000;

export default function Chat({ messages, selfId, typingName, onSend, onTyping }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingName]);

  // Clear any pending "stopped typing" timer on unmount so it doesn't fire
  // after the component (and its onTyping callback) are gone.
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  function notifyTyping(isTyping) {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    onTyping(isTyping);
    // If the person keeps their cursor in the field but stops typing
    // (rather than clearing the text or blurring), the indicator should
    // still clear itself after a short idle period instead of getting
    // stuck on "is typing…" indefinitely.
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
        typingTimeoutRef.current = null;
      }, TYPING_IDLE_MS);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
    notifyTyping(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted text-center mt-10">
            Say hi — this is where your conversation lives while the music plays.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === selfId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div
                  className={`rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? "bg-warm text-ink rounded-br-sm"
                      : "bg-card border border-border text-ptext rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[10px] text-muted px-1">
                  {mine ? "You" : m.sender} ·{" "}
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
        {typingName && <p className="text-xs text-muted italic px-1">{typingName} is typing…</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 p-3 border-t border-border bg-elevated">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            notifyTyping(e.target.value.length > 0);
          }}
          onBlur={() => notifyTyping(false)}
          placeholder="Type a message…"
          className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm placeholder:text-muted focus:border-warm transition-colors"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="bg-warm text-ink font-semibold rounded-xl px-4 disabled:opacity-40 hover:brightness-110 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
