export function loadPins(userId) {
    const s = localStorage.getItem(`cc:pins:${userId}`);
    try {
        return s ? JSON.parse(s) : [];
    }
    catch {
        return [];
    }
}
export function savePins(userId, ids) {
    localStorage.setItem(`cc:pins:${userId}`, JSON.stringify(ids));
}
export function togglePin(userId, id) {
    const cur = new Set(loadPins(userId));
    if (cur.has(id))
        cur.delete(id);
    else
        cur.add(id);
    savePins(userId, Array.from(cur));
}
