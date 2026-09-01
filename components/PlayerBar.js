import { useEffect, useRef, useState } from "react";

function ChevronIcon({ up, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {up ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
    </svg>
  );
}

function PlayIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function formatTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

let ytApiPromise = null;
function loadYouTubeAPI() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = resolve;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });
  return ytApiPromise;
}

/**
 * Persistent player: search, video, and queue live in one bar that stays
 * mounted at the top of the room no matter which tab (chat/game/board) is
 * active. It can collapse to a slim mini-player so chat gets more room.
 */
export default function PlayerBar({ initial, remoteAction, onLocalAction }) {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const searchWrapRef = useRef(null);
  const debounceRef = useRef(null);
  const seekingRef = useRef(false);
  const seq = useRef(0);

  const hasInitialVideo = !!initial?.playback?.videoId;

  const [ready, setReady] = useState(false);
  const [videoId, setVideoId] = useState(initial?.playback?.videoId || null);
  const [title, setTitle] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState(initial?.queue || []);

  const [expanded, setExpanded] = useState(!hasInitialVideo);
  const [showSearch, setShowSearch] = useState(!hasInitialVideo);
  const [showQueue, setShowQueue] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Set up the YouTube IFrame player once. The container div below always
  // stays mounted (only its size changes) so play/pause never resets.
  useEffect(() => {
    let cancelled = false;
    loadYouTubeAPI().then(() => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "100%",
        width: "100%",
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            setReady(true);
            const pb = initial?.playback;
            if (pb?.videoId) {
              // Catch up to wherever the room's playback actually is: if it
              // was already playing, account for time elapsed since the
              // server last recorded it so a newcomer joins in sync instead
              // of at 0:00.
              const elapsed = pb.isPlaying && pb.updatedAt ? Math.max(0, (Date.now() - pb.updatedAt) / 1000) : 0;
              const startAt = Math.max(0, (pb.currentTime || 0) + elapsed);
              setVideoId(pb.videoId);
              setTitle(pb.title || "");
              setCurrent(startAt);
              if (pb.isPlaying) {
                playerRef.current.loadVideoById({ videoId: pb.videoId, startSeconds: startAt });
                setIsPlaying(true);
              } else {
                playerRef.current.cueVideoById({ videoId: pb.videoId, startSeconds: startAt });
              }
            }
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) advanceQueue();
            if (e.data === window.YT.PlayerState.PLAYING) {
              setDuration(playerRef.current.getDuration());
              setIsPlaying(true);
            }
            if (e.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (playerRef.current?.getCurrentTime && isPlaying && !seekingRef.current) {
        setCurrent(playerRef.current.getCurrentTime());
      }
    }, 400);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Apply actions coming from the other person
  useEffect(() => {
    if (!remoteAction || !ready) return;
    const a = remoteAction.action;
    switch (a.type) {
      case "load":
        applyLoad(a.videoId, a.title);
        break;
      case "play":
        if (typeof a.time === "number") playerRef.current.seekTo(a.time, true);
        playerRef.current.playVideo();
        setIsPlaying(true);
        break;
      case "pause":
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        break;
      case "seek":
        playerRef.current.seekTo(a.time, true);
        setCurrent(a.time);
        break;
      case "queue-add":
        setQueue((q) => [...q, { videoId: a.videoId, title: a.title }]);
        break;
      case "queue-remove":
        setQueue((q) => q.filter((q2) => q2.videoId !== a.videoId));
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteAction, ready]);

  // Debounced live search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const mySeq = ++seq.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (mySeq !== seq.current) return; // a newer search superseded this one
        if (data.error) {
          setSearchError(data.error);
          setResults([]);
        } else {
          setSearchError(null);
          setResults(data.results || []);
        }
      } catch {
        if (mySeq !== seq.current) return;
        setSearchError("Couldn't reach search — check your connection.");
        setResults([]);
      } finally {
        if (mySeq === seq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close the results dropdown on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setResults([]);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function applyLoad(id, t) {
    playerRef.current.loadVideoById(id);
    setVideoId(id);
    setTitle(t || "");
    setIsPlaying(true);
    setCurrent(0);
  }

  function loadVideo(id, t) {
    if (!ready) return;
    applyLoad(id, t);
    onLocalAction({ type: "load", videoId: id, title: t || id });
  }

  function playResult(r) {
    loadVideo(r.videoId, r.title);
    setQuery("");
    setResults([]);
    setShowSearch(false);
    setExpanded(true);
  }

  function queueResult(r) {
    setQueue((q) => [...q, { videoId: r.videoId, title: r.title }]);
    onLocalAction({ type: "queue-add", videoId: r.videoId, title: r.title });
  }

  function togglePlay() {
    if (!ready || !videoId) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
      onLocalAction({ type: "pause", time: playerRef.current.getCurrentTime() });
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
      onLocalAction({ type: "play", time: playerRef.current.getCurrentTime() });
    }
  }

  function onSeekChange(e) {
    seekingRef.current = true;
    setCurrent(Number(e.target.value));
  }

  function commitSeek(e) {
    const t = Number(e.target.value);
    playerRef.current.seekTo(t, true);
    onLocalAction({ type: "seek", time: t });
    seekingRef.current = false;
  }

  function removeFromQueue(videoIdToRemove, idx) {
    setQueue((qs) => qs.filter((_, i) => i !== idx));
    onLocalAction({ type: "queue-remove", videoId: videoIdToRemove });
  }

  function advanceQueue() {
    setQueue((q) => {
      if (q.length === 0) {
        setIsPlaying(false);
        return q;
      }
      const [next, ...rest] = q;
      loadVideo(next.videoId, next.title);
      onLocalAction({ type: "queue-remove", videoId: next.videoId });
      return rest;
    });
  }

  return (
    <div className="bg-elevated border-b border-border">
      {/* Always-visible control row */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 py-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          title={expanded ? "Collapse to mini player" : "Expand player"}
          aria-label={expanded ? "Collapse to mini player" : "Expand player"}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ptext hover:bg-card transition"
        >
          <ChevronIcon up={expanded} />
        </button>

        <button
          onClick={togglePlay}
          disabled={!videoId}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="shrink-0 w-9 h-9 rounded-full bg-warm text-white flex items-center justify-center disabled:opacity-30 hover:brightness-110 transition"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {title || "Search a song or video to start watching together"}
          </p>
          <div className="h-1 bg-border rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-warm transition-[width]"
              style={{ width: duration ? `${Math.min((current / duration) * 100, 100)}%` : "0%" }}
            />
          </div>
        </div>

        <button
          onClick={() => setShowSearch((s) => !s)}
          title="Search YouTube"
          aria-label="Search YouTube"
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center border transition ${
            showSearch ? "border-warm text-warm bg-warmsoft" : "border-border text-muted hover:text-ptext hover:border-cool"
          }`}
        >
          <SearchIcon />
        </button>
      </div>

      {/* Search bar + live results dropdown */}
      {showSearch && (
        <div ref={searchWrapRef} className="relative px-3 pb-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a song or video…"
            className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm placeholder:text-muted focus:border-warm transition-colors"
          />
          {query.trim().length > 0 && (
            <div className="absolute left-3 right-3 mt-1.5 max-h-72 overflow-y-auto bg-card border border-border rounded-xl shadow-glow z-30">
              {searching && <p className="p-3 text-sm text-muted">Searching…</p>}
              {!searching && searchError && <p className="p-3 text-sm text-danger">{searchError}</p>}
              {!searching && !searchError && query.trim() && results.length === 0 && (
                <p className="p-3 text-sm text-muted">No results for “{query.trim()}”.</p>
              )}
              {!searching &&
                results.map((r) => (
                  <div
                    key={r.videoId}
                    onClick={() => playResult(r)}
                    className="flex items-center gap-3 p-2 hover:bg-elevated cursor-pointer border-b border-border last:border-b-0 transition-colors"
                  >
                    <div className="relative shrink-0 w-20 h-12 rounded-lg overflow-hidden bg-elevated border border-border">
                      {r.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.thumbnail} alt={r.title || "Video thumbnail"} className="w-full h-full object-cover" />
                      )}
                      {r.duration && (
                        <span className="absolute bottom-0.5 right-0.5 bg-black/75 text-white text-[10px] px-1 rounded">
                          {r.duration}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted truncate">{r.channel}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        queueResult(r);
                      }}
                      className="shrink-0 text-xs border border-border rounded-lg px-2 py-1.5 hover:border-cool hover:text-cool transition"
                    >
                      + Queue
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Video area — always mounted so playback never restarts; only its
          height changes between the full expanded view and a slim mini strip. */}
      <div
        className={`relative overflow-hidden bg-black border-t border-border transition-[height] duration-300 ease-out ${
          expanded ? "aspect-video" : "h-20 sm:h-24"
        }`}
      >
        <div ref={containerRef} className="w-full h-full" />
        {expanded && !videoId && (
          <div className="absolute inset-0 flex items-center justify-center text-muted text-sm px-6 text-center">
            Search above to find a song or video to watch together
          </div>
        )}
      </div>

      {/* Scrub bar, only worth showing when expanded */}
      {expanded && (
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span className="text-xs text-muted w-9 text-right">{formatTime(current)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={Math.min(current, duration || 0)}
            onChange={onSeekChange}
            onMouseUp={commitSeek}
            onTouchEnd={commitSeek}
            disabled={!videoId}
            className="flex-1 accent-warm disabled:opacity-40"
          />
          <span className="text-xs text-muted w-9">{formatTime(duration)}</span>
        </div>
      )}

      {/* Queue */}
      {queue.length > 0 && (
        <button
          onClick={() => setShowQueue((s) => !s)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted border-t border-border hover:text-ptext transition-colors"
        >
          <span>Up next · {queue.length}</span>
          <ChevronIcon up={showQueue} width="14" height="14" />
        </button>
      )}
      {showQueue && queue.length > 0 && (
        <ul className="px-3 pb-3 space-y-1.5">
          {queue.map((q, i) => (
            <li
              key={q.videoId + i}
              className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2 text-sm"
            >
              <button onClick={() => loadVideo(q.videoId, q.title)} className="truncate text-left flex-1 hover:text-warm transition-colors">
                {q.title || q.videoId}
              </button>
              <button
                onClick={() => removeFromQueue(q.videoId, i)}
                className="text-muted hover:text-danger text-xs ml-2 shrink-0"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
