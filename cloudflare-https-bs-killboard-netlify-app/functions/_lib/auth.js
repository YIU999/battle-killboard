const encoder = new TextEncoder();
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
}

export function validUsername(username) {
  return /^[A-Za-z0-9_-]{3,32}$/.test(username);
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password, saltHex = null) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/.{2}/g), (hex) => parseInt(hex, 16)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 }, key, 256);
  return { salt: bytesToHex(salt), hash: bytesToHex(hash) };
}

export async function createSession(db, userId) {
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = bytesToHex(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  await db.prepare("INSERT INTO killboard_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(tokenHash, userId, expiresAt).run();
  return { token, expiresAt };
}

export function sessionCookie(token, maxAge = SESSION_SECONDS) {
  return `session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function getUser(request, db) {
  const token = request.headers.get("Cookie")?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  if (!token) return null;
  const tokenHash = bytesToHex(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
  return db.prepare("SELECT killboard_users.id, killboard_users.username FROM killboard_sessions JOIN killboard_users ON killboard_users.id = killboard_sessions.user_id WHERE killboard_sessions.token_hash = ? AND killboard_sessions.expires_at > ?").bind(tokenHash, Math.floor(Date.now() / 1000)).first();
}

export async function requireUser(request, db) {
  const user = await getUser(request, db);
  if (!user) throw new Response(JSON.stringify({ error: "Authentication required." }), { status: 401, headers: { "Content-Type": "application/json" } });
  return user;
}

export async function getMembers(db, userId) {
  const rows = await db.prepare("SELECT character_name FROM killboard_members WHERE user_id = ? ORDER BY created_at, id").bind(userId).all();
  return rows.results.map((row) => row.character_name);
}
