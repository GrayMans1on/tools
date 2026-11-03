const storageKey = 'gm-tools-usage-v1';
const registered = new Set();

export function readUsage() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) { return {}; }
    return Object.fromEntries(Object.entries(value).filter(([id, count]) =>
      /^[a-z][a-z0-9-]*$/.test(id) && Number.isSafeInteger(count) && count >= 0));
  } catch (error) { return {}; }
}

export function registerUsage(id) {
  if (registered.has(id) || !/^[a-z][a-z0-9-]*$/.test(id)) { return; }
  registered.add(id);
  const counts = readUsage();
  counts[id] = Math.min(Number.MAX_SAFE_INTEGER, (counts[id] || 0) + 1);
  try {
    localStorage.setItem(storageKey, JSON.stringify(counts));
    const owner = window.parent;
    owner.dispatchEvent(new owner.CustomEvent('gm-tools-usage'));
  } catch (error) { }
}
