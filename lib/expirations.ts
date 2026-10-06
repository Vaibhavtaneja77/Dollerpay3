const SYNC_WINDOW_MS = 20_000;
const recentSyncs = new Map<string, { promise: Promise<void>; expiresAt: number }>();

export async function syncPendingExpirations(userId?: string) {
  const key = userId ?? "all";
  const cached = recentSyncs.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = Promise.resolve();

  recentSyncs.set(key, { promise, expiresAt: Date.now() + SYNC_WINDOW_MS });
  await promise;
}
