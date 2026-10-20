/** Comma-separated input → unique trimmed values (max 15), as the prototype's `parseSkills`. */
export function parseSkills(value: string | null | undefined) {
  return [...new Set(String(value || "").split(",").map((v) => v.trim()).filter(Boolean))].slice(0, 15);
}

/** Comma or newline separated input → unique trimmed values. */
export function splitList(value: string | null | undefined) {
  return [...new Set(String(value || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean))];
}

export const initials = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");

export const firstName = (name: string) => name.split(" ")[0];

export const plural = (n: number, one: string, many = one + "s") => (n === 1 ? one : many);

/** Class name joiner. */
export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
