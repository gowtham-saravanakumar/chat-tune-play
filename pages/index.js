import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { customAlphabet } from "nanoid";
import Head from "next/head";
import ProfileSetup from "@/components/ProfileSetup";
import Credits from "@/components/Credits";
import { loadProfile, saveProfile } from "@/lib/profile";

const genCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setHydrated(true);
  }, []);

  function handleProfileSave(p) {
    saveProfile(p);
    setProfile(p);
  }

  function createRoom() {
    const code = genCode();
    router.push(`/room/${code}`);
  }

  function joinRoom(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    router.push(`/room/${joinCode.trim().toUpperCase()}`);
  }

  const head = (
    <Head>
      <meta name="google-site-verification" content="FTCjPK7q39HT8cXZ4MJfEEACZ0jOzrPb2jyJ_RSUETg" />
      <title>Chatuneplay — Watch YouTube Together, Chat & Play</title>
      <meta
        name="description"
        content="Chatuneplay is a private room for two — search and watch YouTube together with a synced player, chat live, play tic-tac-toe, and doodle on a shared board. No login, just a room code."
      />
    </Head>
  );

  if (!hydrated) return head;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {head}

      {/* Background photo */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-no-repeat bg-[position:40%_12%] sm:bg-[position:48%_18%] lg:bg-[position:50%_center]"
        style={{ backgroundImage: "url(/hero-bg.jpg)" }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-white/35 to-white/65" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-10 animate-floatin bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl px-6 py-6 shadow-glow">
          <p className="text-xs uppercase tracking-[0.3em] text-cool mb-3">for the two of you</p>
          <h1 className="font-display text-4xl sm:text-5xl mb-3">Chatuneplay</h1>
          <p className="text-muted max-w-sm mx-auto">
            Search and watch YouTube together, chat live, and play a little game — one room, no matter the distance between you.
          </p>
        </div>

        {!profile ? (
          <ProfileSetup onSave={handleProfileSave} />
        ) : (
          <div className="w-full max-w-sm space-y-4 animate-floatin bg-card/95 backdrop-blur-md border border-border rounded-2xl p-6 shadow-glow">
            <div className="flex items-center gap-2 justify-center text-sm text-muted mb-2">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: profile.avatar?.startsWith("#") ? profile.avatar : "#1A73E8" }}
              >
                {(profile.name || "?").trim().charAt(0).toUpperCase()}
              </span>
              <span>
                Signed in as <span className="text-ptext font-medium">{profile.name}</span>
              </span>
              <button onClick={() => setProfile(null)} className="text-cool hover:underline text-xs ml-1">
                change
              </button>
            </div>

            <button
              onClick={createRoom}
              className="w-full bg-warm text-white font-medium rounded-lg py-4 shadow-glow hover:brightness-110 transition"
            >
              Create a room
            </button>

            <div className="flex items-center gap-3 text-muted text-xs">
              <div className="flex-1 h-px bg-border" />
              or join theirs
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={joinRoom} className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Room code"
                className="flex-1 bg-elevated border border-border rounded-xl px-4 py-3 font-mono tracking-widest uppercase placeholder:tracking-normal placeholder:font-body placeholder:text-muted focus:border-cool transition-colors"
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="bg-card border border-border font-semibold rounded-xl px-5 disabled:opacity-40 hover:border-cool transition"
              >
                Join
              </button>
            </form>
          </div>
        )}

        <div className="mt-10 bg-white/70 backdrop-blur-md border border-white/60 rounded-xl px-5 py-3">
          <Credits />
        </div>
      </div>
    </div>
  );
}
