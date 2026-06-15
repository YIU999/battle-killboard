import { createSession, getMembers, hashPassword, json, sessionCookie, validUsername } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const { username = "", password = "" } = await request.json();
  if (!validUsername(username)) return json({ error: "User ID must be 3-32 characters using letters, numbers, _ or -." }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: "Password must be 8-128 characters." }, 400);
  const existing = await env.DB.prepare("SELECT id FROM killboard_users WHERE username = ? COLLATE NOCASE").bind(username).first();
  if (existing) return json({ error: "That User ID is already in use." }, 409);
  const passwordData = await hashPassword(password);
  const result = await env.DB.prepare("INSERT INTO killboard_users (username, password_hash, password_salt) VALUES (?, ?, ?)").bind(username, passwordData.hash, passwordData.salt).run();
  const user = { id: result.meta.last_row_id, username };
  const session = await createSession(env.DB, user.id);
  return json({ user, members: await getMembers(env.DB, user.id) }, 201, { "Set-Cookie": sessionCookie(session.token) });
}
