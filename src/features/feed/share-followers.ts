/** Local follower search for the share sheet. Does not call the network API. */
export function filterFollowers<T extends { name: string; headline?: string }>(people: T[], query: string): T[] {
  const q = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (!q) return people;
  return people.filter((person) => person.name.toLowerCase().includes(q) || (person.headline ?? "").toLowerCase().includes(q));
}
