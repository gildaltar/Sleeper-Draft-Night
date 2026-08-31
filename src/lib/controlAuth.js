export async function checkCommissioner(client, session) {
  if (!session) return false;
  const result = await client
    .from("commissioners")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (result.error) throw result.error;
  return Boolean(result.data);
}

export function afterAuthLock(task, scheduler = window.setTimeout) {
  return scheduler(task, 0);
}
