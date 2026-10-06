export function getExpiresAt(createdAt: string, durationMs: number) {
  return new Date(new Date(createdAt).getTime() + durationMs).toISOString();
}

export function getRemainingMs(expiresAt: string) {
  return new Date(expiresAt).getTime() - Date.now();
}

export function formatRemainingDuration(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
