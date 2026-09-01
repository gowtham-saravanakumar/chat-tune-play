import { io } from "socket.io-client";

// Same-origin by default — the Socket.IO server is attached to this
// same Next.js app (see server.js), so no separate backend URL is
// needed. NEXT_PUBLIC_SERVER_URL is only for the rare case you split
// the backend out to its own host later.
const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || undefined;

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      path: "/socket.io",
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
