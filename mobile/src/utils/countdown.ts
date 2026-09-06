export function formatCountdown(startTime: string, now: number = Date.now()): string {
  const diffMs = new Date(startTime).getTime() - now;
  if (diffMs <= 0) return 'Live';

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min`;
  return `${seconds}sec`;
}
