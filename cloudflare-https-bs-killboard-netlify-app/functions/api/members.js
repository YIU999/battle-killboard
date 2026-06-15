import { getMembers, json, requireUser } from "../_lib/auth.js";

export async function onRequestPut({ request, env }) {
  try {
    const user = await requireUser(request, env.DB);
    const body = await request.json();
    const seen = new Set();
    const members = (Array.isArray(body.members) ? body.members : []).map((name) => String(name).trim()).filter((name) => {
      const key = name.toLowerCase();
      if (!name || name.length > 64 || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 500);
    const statements = [env.DB.prepare("DELETE FROM killboard_members WHERE user_id = ?").bind(user.id)];
    members.forEach((name) => statements.push(env.DB.prepare("INSERT INTO killboard_members (user_id, character_name) VALUES (?, ?)").bind(user.id, name)));
    await env.DB.batch(statements);
    return json({ members: await getMembers(env.DB, user.id) });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Could not save members." }, 500);
  }
}
