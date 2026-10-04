/** Start of the window `days` before now. Kept out of components so render stays pure. */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}
