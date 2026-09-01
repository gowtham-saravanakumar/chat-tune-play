# Chatuneplay

A private room for two — search and watch YouTube together with a synced
player, chat live the whole time, play a quick game of XOXO (tic-tac-toe),
and doodle on a shared board. No login, just a room code.

This is a **single Node.js app**. The Next.js frontend and the Socket.IO
realtime backend (chat, playback sync, game moves, doodle broadcasting) run
in one process, on one port — see `server.js`. There is nothing separate to
deploy: one host, one build, one start command.

## What's inside

```
chatuneplay/
├── server.js         Custom server: Next.js + Socket.IO on one HTTP server
├── pages/
│   ├── api/youtube-search.js   Server-side YouTube search (no API key, no quota — reads public search results)
│   ├── index.js                 Home (create/join a room)
│   └── room/[code].js           The room itself
├── components/        Chat, PlayerBar, Tabs, TicTacToe, DoodleBoard, ...
├── lib/                Client-side helpers (socket connection, local profile)
└── styles/             Tailwind + global CSS
```

## Features

| Feature | Status | Notes |
|---|---|---|
| Profile (no login) | ✅ Built | Name + avatar, stored locally in the browser, no password |
| Room create/join | ✅ Built | Random 6-char code, shareable link |
| **Instant YouTube search** | ✅ Built | Type a song or video name, results appear live, tap to play — pasting links is not supported |
| **Persistent player / mini player** | ✅ Built | Stays pinned at the top across every tab; collapse it to a slim strip without stopping playback |
| Synced playback | ✅ Built | Play/pause/seek/queue mirrored live to the other person |
| Real-time chat | ✅ Built | Always visible — a permanent sidebar on desktop, its own tab on mobile — so you never have to leave chat to watch or listen together |
| XOXO (tic-tac-toe) | ✅ Built | Server-authoritative turns, win detection |
| Shared doodle & notes board | ✅ Built | In-app canvas, lives inside the Board tab |
| Responsive layout | ✅ Built | One codebase, tuned separately for phone, tablet, and desktop widths |
| Video / audio calling | ❌ Removed | Taken out at the user's request |
| Google sign-in / allow-listed accounts | ❌ Not in this build | See "About the Google sign-in version" below |

### How search & playback work together

Typing in the search bar hits `/api/youtube-search`, a Next.js API route
that fetches YouTube's own public search results page on the server and
reads the same data YouTube uses to render it — no YouTube Data API key
and no daily quota involved. It returns simplified results (title,
channel, thumbnail, duration). Selecting a result loads it straight into
the shared player and broadcasts that choice to the other person over
Socket.IO, the same way play/pause/seek/queue already synced. The video
element itself never unmounts when you collapse the player to its mini
form — only its height changes — so playback is never interrupted.
There is no "paste a link" input anywhere — the only way to load a video
is to search and pick a result, so both people always see it in the same
in-app search UI.

### Why there's no real lock-screen drawing

A website cannot draw on your phone's actual OS lock screen — that needs a
native iOS (WidgetKit/Live Activities) or Android (App Widget) app with
special system permissions, which is a separate project in Swift/Kotlin, not
something that runs in a browser. The **Board** tab is the in-app equivalent:
draw or leave a note, and it appears live for your partner next time they
open the app.

### About the Google sign-in version

This build keeps the original lightweight profile (name + avatar, no
password, stored per-browser) rather than Google OAuth + a database. That
was a deliberate scope call to keep this a true single-file/single-server
deploy: NextAuth + Postgres/Supabase adds a database dependency, OAuth
credentials, and session cookies, all of which are real, worthwhile
additions — but they turn this from "one app, one host" into "one app plus a
managed database," which is a different, larger job. Room codes (random,
6-character, shareable link only) remain the access control.

## Prerequisites

- Node.js 18 or later (needed for the built-in `fetch` used by the search API route)
- npm
- No API keys needed — search works out of the box.

## Running it locally

```bash
npm install
npm run dev
```
Open `http://localhost:3000`. One command, one process — no second terminal
needed.

## Deploying — one app, one host

Any host that runs a persistent Node.js process works: **Render, Railway,
Fly.io, a VPS, DigitalOcean App Platform, etc.** Plain static hosts
(Netlify's default tier, GitHub Pages, S3) will **not** work, because this
app needs a long-running process to hold the WebSocket connections for chat
and playback sync — that's not something a static file server can do.

**Example: Render (or Railway/Fly.io — steps are nearly identical)**
1. Push this project to a GitHub repo. `.env.local` is gitignored on purpose
   — your API key will **not** be pushed with it.
2. Create a new "Web Service" pointing at the repo root.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Render/Railway/Fly.io set `PORT` automatically — `server.js` already
   reads `process.env.PORT`.
6. Deploy. Your app is live at the URL the host gives you.

**On a plain VPS (Ubuntu, DigitalOcean droplet, etc.)**
```bash
git clone <your-repo>
cd chatuneplay
npm install
npm run build
npm start        # or run under pm2 / systemd so it survives reboots/SSH exit
```
Put it behind Nginx or Caddy for HTTPS (Caddy will auto-issue a cert if you
point a domain at the server — that's the fastest path).

## Environment variables

| Var | Required? | Purpose |
|---|---|---|
| `PORT` | No | Port to listen on. Most hosts set this for you; defaults to `3000` locally. |
| `NEXT_PUBLIC_SERVER_URL` | No | Only set this if you later split the Socket.IO server onto a *different* host than the frontend. Leave unset for the normal single-server setup in this build. |

## A note on the YouTube search approach

`/api/youtube-search` fetches YouTube's public search results page on the
server and parses the same JSON data the page itself renders from, instead
of calling the official, quota-limited YouTube Data API. That means:
- No API key to create, restrict, or rotate.
- No daily search quota to run into.
- It depends on YouTube's page structure rather than a stable, versioned
  API, so if YouTube changes how that page is built, parsing may need a
  small update in `pages/api/youtube-search.js`.

## Known limitations (prototype scope)

- **No database** — rooms, chat history, and the doodle board live in server
  memory and reset if the server restarts. Fine for casual use; if you want
  messages/notes to survive restarts, add Postgres (Supabase's free tier is
  an easy fit) and swap the in-memory `Map`s in `server.js` for reads/writes
  to it.
- **Room codes are the only "auth"** — anyone with the link can join, but
  each room is hard-capped at two people; a third visitor is turned away
  with a "room is full" message instead of being let in.
- **Search depends on YouTube's search page structure**, not a stable
  versioned API — see the note above.
- **Single process = single point of scale.** Fine for two people. If you
  ever needed this for many simultaneous rooms at once, you'd eventually
  want to move room state out of process memory (e.g. Redis) so you could
  run more than one server instance — not a concern at this app's actual
  scale.

## Extending it

The code is structured so each feature is its own component on the frontend
and its own Socket.IO event namespace on the backend, so you can touch one
without breaking the others: `profile → room/chat → search & playback sync →
XOXO → doodle board`.

## Credits

Created by **Gowtham Saravanakumar**

- Instagram: https://www.instagram.com/gowtham_saravanakumar/
- X (Twitter): https://x.com/gowtham_says
- LinkedIn: https://in.linkedin.com/in/gowtham-now
- GitHub: https://github.com/gowtham-saravanakumar

If you find this useful, consider [buying me a coffee](https://buymeacoffee.com/gowthamsaravanakumar) ☕
