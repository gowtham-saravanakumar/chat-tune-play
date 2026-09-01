const KEY = "chatuneplay:profile";

export function loadProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(profile));
}

// Avatars are plain colored circles showing the person's initial —
// no emoji. Colors are drawn from Google's Material palette.
export const AVATAR_OPTIONS = [
  "#1A73E8", // blue
  "#188038", // green
  "#D93025", // red
  "#F9AB00", // yellow
  "#8430CE", // purple
  "#12B5CB", // teal
  "#E8710A", // orange
  "#5F6368", // grey
];
