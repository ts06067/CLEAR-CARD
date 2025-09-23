export function loadPins(userId: string): string[] {
  const s = localStorage.getItem(`cc:pins:${userId}`);
  try { return s ? JSON.parse(s) : []; } catch { return []; }
}
export function savePins(userId: string, ids: string[]) {
  localStorage.setItem(`cc:pins:${userId}`, JSON.stringify(ids));
}
export function togglePin(userId: string, id: string) {
  const cur = new Set(loadPins(userId));
  if (cur.has(id)) cur.delete(id); else cur.add(id);
  savePins(userId, Array.from(cur));
}
