/** How many hidden replies the next Show more click should reveal. */
export function nextReplyReveal(hidden: number) {
  if (hidden <= 0) return 0;
  if (hidden <= 4) return hidden;
  if (hidden <= 10) return Math.ceil(hidden / 2);
  return 5;
}

export const INITIAL_VISIBLE_REPLIES = 2;
