import { useState } from "react";
import { AVATAR_OPTIONS } from "@/lib/profile";

export default function ProfileSetup({ onSave, initial }) {
  const [name, setName] = useState(initial?.name || "");
  const [avatar, setAvatar] = useState(initial?.avatar || AVATAR_OPTIONS[0]);

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim().slice(0, 24), avatar });
  }

  const initial_letter = name.trim().charAt(0).toUpperCase();

  return (
    <form onSubmit={submit} className="w-full max-w-sm animate-floatin bg-card border border-border rounded-2xl p-8 shadow-glow">
      <p className="text-sm text-muted mb-1">Before you go in</p>
      <h2 className="font-display text-2xl font-medium mb-6 text-ptext">What should we call you?</h2>

      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-medium text-lg shrink-0"
          style={{ backgroundColor: avatar }}
        >
          {initial_letter || "?"}
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="flex-1 bg-elevated border border-border rounded-lg px-4 py-3 text-ptext placeholder:text-muted focus:border-warm focus:outline-none transition-colors"
        />
      </div>

      <p className="text-sm text-muted mb-3">Pick a color</p>
      <div className="grid grid-cols-8 gap-2 mb-7">
        {AVATAR_OPTIONS.map((a) => (
          <button
            type="button"
            key={a}
            onClick={() => setAvatar(a)}
            aria-label={`Choose color ${a}`}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              avatar === a ? "border-ptext scale-110" : "border-transparent hover:scale-105"
            }`}
            style={{ backgroundColor: a }}
          />
        ))}
      </div>

      <button
        type="submit"
        disabled={!name.trim()}
        className="w-full bg-warm text-white font-medium rounded-lg py-3 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
      >
        Continue
      </button>
      <p className="text-xs text-muted mt-4 text-center">
        No account needed — this name is only shown to whoever you share a room with.
      </p>
    </form>
  );
}
