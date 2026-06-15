import { createSession, getMembers, hashPassword, json, sessionCookie } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const { username = "", password = "" } = await request.json();
  const user = await env.DB.prepare("SELECT id, username, password_hash, password_salt FROM killboard_users WHERE username = ? COLLATE NOCASE").bind(username).first();
  if (!user) return json({ error: "Invalid User ID or password." }, 401);
  const candidate = await hashPassword(password, user.password_salt);
  if (candidate.hash !== user.password_hash) return json({ error: "Invalid User ID or password." }, 401);
  const session = await createSession(env.DB, user.id);
  return json({ user: { id: user.id, username: user.username }, members: await getMembers(env.DB, user.id) }, 200, { "Set-Cookie": sessionCookie(session.token) });
}
