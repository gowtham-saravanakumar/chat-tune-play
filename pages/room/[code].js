import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { getSocket } from "@/lib/socket";
import { loadProfile, saveProfile } from "@/lib/profile";
import ProfileSetup from "@/components/ProfileSetup";
import PresenceBar from "@/components/PresenceBar";
import Tabs from "@/components/Tabs";
import Chat from "@/components/Chat";
import PlayerBar from "@/components/PlayerBar";
import TicTacToe from "@/components/TicTacToe";
import DoodleBoard from "@/components/DoodleBoard";
import Credits from "@/components/Credits";

const MAX_CLIENT_MESSAGES = 100; // keep in sync with server.js's MAX_MESSAGES

export default function Room() {
  const router = useRouter();
  const { code } = router.query;
  const socketRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const [connectError, setConnectError] = useState(false);
  const [selfId, setSelfId] = useState(null);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState("chat");
  const [unread, setUnread] = useState({});

  // Mirrors the current `tab` for use inside socket callbacks registered in
  // an effect that doesn't re-run on every tab switch — without this the
  // callbacks would always see the tab value from when the effect first
  // ran, so unread badges would never match what's actually on screen.
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const [initialState, setInitialState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingName, setTypingName] = useState(null);
  const [musicRemote, setMusicRemote] = useState(null);
  const [game, setGame] = useState(null);
  // The doodle board's items live here (not inside DoodleBoard) so drawings
  // survive switching away from the Board tab and back — DoodleBoard is
  // unmounted/remounted on every tab switch, so any state kept inside it
  // would be lost the moment the tab changed.
  const [boardItems, setBoardItems] = useState([]);
  const seq = useRef(0);

  useEffect(() => {
    setProfile(loadProfile());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!code || !profile) return;
    const socket = getSocket();
    socketRef.current = socket;
    setConnectError(false);
    socket.connect();

    function onConnect() {
      setConnectError(false);
      setSelfId(socket.id);
      socket.emit("join-room", { code, profile });
    }
    function onConnectError() {
      setConnectError(true);
    }
    function onRoomState(state) {
      setInitialState(state);
      setUsers(state.users);
      setMessages(state.messages);
      setGame(state.game);
      setBoardItems(state.board.items);
      setSelfId(state.selfId);
      setJoined(true);
    }
    function onPresence(u) {
      setUsers(u);
    }
    function onChat(msg) {
      setMessages((m) => {
        const next = [...m, msg];
        return next.length > MAX_CLIENT_MESSAGES ? next.slice(next.length - MAX_CLIENT_MESSAGES) : next;
      });
      setUnread((u) => (tabRef.current !== "chat" ? { ...u, chat: (u.chat || 0) + 1 } : u));
    }
    function onTyping({ name, isTyping }) {
      setTypingName(isTyping ? name : null);
    }
    function onMusicAction(action) {
      seq.current += 1;
      setMusicRemote({ seq: seq.current, action });
    }
    function onGameUpdate(g) {
      setGame(g);
      setUnread((u) => (tabRef.current !== "game" ? { ...u, game: (u.game || 0) + 1 } : u));
    }
    function onBoardItem(item) {
      setBoardItems((its) => [...its, item]);
    }
    function onBoardClear() {
      setBoardItems([]);
    }
    function onRoomFull() {
      setRoomFull(true);
      socket.disconnect();
    }

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("room-state", onRoomState);
    socket.on("presence-update", onPresence);
    socket.on("chat:message", onChat);
    socket.on("chat:typing", onTyping);
    socket.on("music:action", onMusicAction);
    socket.on("game:update", onGameUpdate);
    socket.on("board:item", onBoardItem);
    socket.on("board:clear", onBoardClear);
    socket.on("room-full", onRoomFull);

    if (socket.connected) onConnect();

    return () => {
      socket.emit("leave-room");
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("room-state", onRoomState);
      socket.off("presence-update", onPresence);
      socket.off("chat:message", onChat);
      socket.off("chat:typing", onTyping);
      socket.off("music:action", onMusicAction);
      socket.off("game:update", onGameUpdate);
      socket.off("board:item", onBoardItem);
      socket.off("board:clear", onBoardClear);
      socket.off("room-full", onRoomFull);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, profile]);

  function switchTab(t) {
    setTab(t);
    setUnread((u) => ({ ...u, [t]: 0 }));
  }

  function sendChat(text) {
    socketRef.current.emit("chat:message", { code, text });
  }
  function sendTyping(isTyping) {
    socketRef.current.emit("chat:typing", { code, isTyping });
  }
  function sendMusicAction(action) {
    socketRef.current.emit("music:action", { code, action });
  }
  function sendMove(index) {
    socketRef.current.emit("game:move", { code, index });
  }
  function resetGame() {
    socketRef.current.emit("game:reset", { code });
  }
  function addBoardItem(item) {
    setBoardItems((its) => [...its, item]);
    socketRef.current.emit("board:item", { code, item });
  }
  function clearBoard() {
    setBoardItems([]);
    socketRef.current.emit("board:clear", { code });
  }

  const [linkCopied, setLinkCopied] = useState(false);
  function copyLink() {
    const url = `${window.location.origin}/room/${code}`;
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1500);
      })
      .catch(() => {});
  }

  if (!hydrated || !code) return null;

  if (roomFull) {
    return (
      <div className="min-h-screen bg-app-gradient flex flex-col items-center justify-center px-4 gap-8">
        <div className="w-full max-w-sm text-center bg-card border border-border rounded-2xl p-8">
          <h2 className="text-xl font-medium text-ptext mb-2">This room is full</h2>
          <p className="text-sm text-muted mb-6">
            Room {code} already has two people in it. Only two people are allowed per room.
          </p>
          <button
            onClick={() => router.push("/")}
            className="bg-warm text-white font-medium rounded-lg px-5 py-2.5 hover:brightness-110 transition"
          >
            Back to home
          </button>
        </div>
        <Credits compact />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-app-gradient flex flex-col items-center justify-center px-4 gap-8">
        <ProfileSetup
          onSave={(p) => {
            saveProfile(p);
            setProfile(p);
          }}
        />
        <Credits compact />
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-app-gradient flex flex-col items-center justify-center gap-8 px-4">
        {connectError ? (
          <div className="w-full max-w-sm text-center bg-card border border-border rounded-2xl p-8">
            <h2 className="text-xl font-medium text-ptext mb-2">Couldn't connect</h2>
            <p className="text-sm text-muted mb-6">
              We're having trouble reaching the server. Check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-warm text-white font-medium rounded-lg px-5 py-2.5 hover:brightness-110 transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <p className="text-muted animate-pulse">Connecting to {code}…</p>
        )}
        <Credits compact />
      </div>
    );
  }

  const chatPanel = (
    <Chat messages={messages} selfId={selfId} typingName={typingName} onSend={sendChat} onTyping={sendTyping} />
  );

  return (
    <div className="h-screen flex flex-col bg-ink overflow-hidden">
      <Head>
        <title>Room {code} · Chatuneplay</title>
      </Head>

      <PresenceBar users={users} selfId={selfId} roomCode={code} onCopyLink={copyLink} linkCopied={linkCopied} />

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Main column: persistent player on top, then chat/game/board below */}
        <div className="flex-1 min-h-0 flex flex-col">
          <PlayerBar
            initial={{ playback: initialState.playback, queue: initialState.queue }}
            remoteAction={musicRemote}
            onLocalAction={sendMusicAction}
          />

          <div className="flex-1 min-h-0 flex flex-col sm:flex-row-reverse">
            <Tabs active={tab} onChange={switchTab} unread={unread} />

            <div className="flex-1 min-h-0 flex flex-col">
              {/* Chat lives here only up to the lg breakpoint — beyond that it's
                  a permanent sidebar so people never have to leave it. */}
              <div className={`min-h-0 flex-1 flex-col lg:hidden ${tab === "chat" ? "flex" : "hidden"}`}>
                {chatPanel}
              </div>

              {/* Desktop: chat has its own sidebar, so give this tab a friendly
                  nudge toward the other shared activities instead of blank space. */}
              {tab === "chat" && (
                <div className="hidden lg:flex flex-1 min-h-0 flex-col items-center justify-center text-center px-8 gap-4">
                  <p className="text-muted text-sm max-w-xs">
                    Chat's always open on the right. Want to do something together too?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => switchTab("game")}
                      className="bg-card border border-border rounded-xl px-4 py-2.5 text-sm font-medium hover:border-warm hover:text-warm transition"
                    >
                      Play XOXO
                    </button>
                    <button
                      onClick={() => switchTab("board")}
                      className="bg-card border border-border rounded-xl px-4 py-2.5 text-sm font-medium hover:border-cool hover:text-cool transition"
                    >
                      Doodle together
                    </button>
                  </div>
                </div>
              )}

              {tab === "game" && game && (
                <TicTacToe game={game} selfId={selfId} onMove={sendMove} onReset={resetGame} />
              )}
              {tab === "board" && (
                <DoodleBoard items={boardItems} onAddItem={addBoardItem} onClear={clearBoard} />
              )}
            </div>
          </div>
        </div>

        {/* Desktop-only permanent chat sidebar */}
        <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] border-l border-border flex-col shrink-0">
          {chatPanel}
        </div>
      </div>
    </div>
  );
}
