import { getMembers, json, requireUser } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  try {
    const user = await requireUser(request, env.DB);
    return json({ user, members: await getMembers(env.DB, user.id) });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Database is not configured." }, 500);
  }
}
