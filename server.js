/**
 * Single-process server for "Chatuneplay".
 *
 * This runs the Next.js frontend AND the Socket.IO realtime backend
 * (chat, YouTube playback sync, XOXO, doodle board) on one Node
 * process and one port. Deploy this one app to one host — there is
 * no separate backend service to stand up.
 *
 *   npm install
 *   npm run build
 *   npm start
 */
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const dev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 3000;
const ROOM_TTL_MS = 10 * 60 * 1000; // keep empty rooms alive 10 min in case of refresh
const MAX_MESSAGES = 100;
const MAX_BOARD_ITEMS = 300;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const io = new Server(server, {
    path: "/socket.io",
  });

  /** @type {Map<string, Room>} */
  const rooms = new Map();
  const emptyTimers = new Map();

  function freshBoard() {
    return { items: [] };
  }

  function freshGame() {
    return { board: Array(9).fill(null), turn: "X", winner: null, players: [] };
  }

  function getOrCreateRoom(code) {
    if (!rooms.has(code)) {
      rooms.set(code, {
        code,
        users: new Map(), // socketId -> { id, name, avatar }
        playback: { videoId: null, title: "", isPlaying: false, currentTime: 0, updatedAt: Date.now() },
        queue: [],
        messages: [],
        game: freshGame(),
        board: freshBoard(),
      });
    }
    return rooms.get(code);
  }

  function usersArray(room) {
    return Array.from(room.users.values());
  }

  function checkWinner(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    if (board.every(Boolean)) return "draw";
    return null;
  }

  function cancelEmptyTimer(code) {
    const t = emptyTimers.get(code);
    if (t) {
      clearTimeout(t);
      emptyTimers.delete(code);
    }
  }

  function scheduleCleanupIfEmpty(code) {
    const room = rooms.get(code);
    if (!room) return;
    if (room.users.size === 0) {
      cancelEmptyTimer(code);
      const timer = setTimeout(() => {
        const r = rooms.get(code);
        if (r && r.users.size === 0) rooms.delete(code);
        emptyTimers.delete(code);
      }, ROOM_TTL_MS);
      emptyTimers.set(code, timer);
    }
  }

  io.on("connection", (socket) => {
    socket.on("join-room", ({ code, profile }) => {
      if (!code || !profile?.name) return;

      const existingRoom = rooms.get(code);
      const alreadyInRoom = existingRoom?.users.has(socket.id);

      // Only two people are ever allowed in a room. Reject anyone else
      // instead of creating or joining the room.
      if (existingRoom && !alreadyInRoom && existingRoom.users.size >= 2) {
        socket.emit("room-full", { code });
        return;
      }

      cancelEmptyTimer(code);

      const room = getOrCreateRoom(code);
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.profile = profile;

      room.users.set(socket.id, { id: socket.id, name: profile.name, avatar: profile.avatar || "#1A73E8" });

      // Assign tic-tac-toe symbols in join order, capped at 2 players
      if (!room.game.players.includes(socket.id) && room.game.players.length < 2) {
        room.game.players.push(socket.id);
      }

      socket.emit("room-state", {
        users: usersArray(room),
        playback: room.playback,
        queue: room.queue,
        messages: room.messages,
        game: room.game,
        board: room.board,
        selfId: socket.id,
      });

      io.to(code).emit("presence-update", usersArray(room));
      io.to(code).emit("game:update", room.game);
    });

    socket.on("chat:message", ({ code, text }) => {
      const room = rooms.get(code);
      if (!room || !text?.trim()) return;
      const profile = socket.data.profile || {};
      const msg = {
        id: nanoid(8),
        senderId: socket.id,
        sender: profile.name || "Someone",
        avatar: profile.avatar || "#1A73E8",
        text: text.slice(0, 2000),
        timestamp: Date.now(),
      };
      room.messages.push(msg);
      if (room.messages.length > MAX_MESSAGES) room.messages.shift();
      io.to(code).emit("chat:message", msg);
    });

    socket.on("chat:typing", ({ code, isTyping }) => {
      const profile = socket.data.profile || {};
      socket.to(code).emit("chat:typing", { name: profile.name, isTyping: !!isTyping });
    });

    socket.on("music:action", ({ code, action }) => {
      const room = rooms.get(code);
      if (!room || !action) return;

      if (action.type === "queue-add") {
        room.queue.push({ videoId: action.videoId, title: action.title || action.videoId, addedBy: socket.data.profile?.name });
      } else if (action.type === "queue-remove") {
        room.queue = room.queue.filter((q) => q.videoId !== action.videoId);
      } else if (action.type === "load") {
        // Loading a new video always starts it playing (the player calls
        // loadVideoById, which autoplays), so track that here too —
        // otherwise a newcomer who joins right after would be told the
        // room is paused even though playback is actually underway.
        room.playback = {
          videoId: action.videoId,
          title: action.title || action.videoId,
          isPlaying: true,
          currentTime: typeof action.time === "number" ? action.time : 0,
          updatedAt: Date.now(),
        };
      } else {
        room.playback = {
          ...room.playback,
          videoId: action.videoId ?? room.playback.videoId,
          isPlaying: action.type === "play" ? true : action.type === "pause" ? false : room.playback.isPlaying,
          currentTime: typeof action.time === "number" ? action.time : room.playback.currentTime,
          updatedAt: Date.now(),
        };
      }
      socket.to(code).emit("music:action", action);
    });

    socket.on("game:move", ({ code, index }) => {
      const room = rooms.get(code);
      if (!room) return;
      const g = room.game;
      const symbol = g.players[0] === socket.id ? "X" : g.players[1] === socket.id ? "O" : null;
      if (!symbol || symbol !== g.turn || g.winner || g.board[index]) return;

      g.board[index] = symbol;
      g.winner = checkWinner(g.board);
      g.turn = symbol === "X" ? "O" : "X";
      io.to(code).emit("game:update", g);
    });

    socket.on("game:reset", ({ code }) => {
      const room = rooms.get(code);
      if (!room) return;
      const players = room.game.players;
      room.game = { ...freshGame(), players };
      io.to(code).emit("game:update", room.game);
    });

    socket.on("board:item", ({ code, item }) => {
      const room = rooms.get(code);
      if (!room || !item) return;
      room.board.items.push(item);
      if (room.board.items.length > MAX_BOARD_ITEMS) room.board.items.shift();
      socket.to(code).emit("board:item", item);
    });

    socket.on("board:clear", ({ code }) => {
      const room = rooms.get(code);
      if (!room) return;
      room.board.items = [];
      io.to(code).emit("board:clear");
    });

    socket.on("leave-room", () => handleLeave(socket));
    socket.on("disconnect", () => handleLeave(socket));

    function handleLeave(socket) {
      const code = socket.data.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      room.users.delete(socket.id);
      room.game.players = room.game.players.filter((id) => id !== socket.id);
      io.to(code).emit("presence-update", usersArray(room));
      io.to(code).emit("game:update", room.game);
      scheduleCleanupIfEmpty(code);
      socket.data.roomCode = null;
    }
  });

  server.listen(PORT, () => {
    console.log(`> Chatuneplay is running on port ${PORT} (${dev ? "development" : "production"})`);
  });
});
