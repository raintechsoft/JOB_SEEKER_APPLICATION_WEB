/** Split a free-text job description into company and role sections when those headings exist. */
export function splitJobAbout(description: string): { company: string; role: string } {
  const text = description.trim();
  if (!text) return { company: "", role: "" };
  const matches = [...text.matchAll(/(company\s+description|role\s+description)\s*[:.\-]?\s*/gi)];
  if (!matches.length) return { company: "", role: text };
  const sections: { heading: string; body: string }[] = [];
  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length;
    sections.push({ heading: match[1].toLowerCase(), body: text.slice(start, end).trim() });
  }
  const preface = text.slice(0, matches[0].index).trim();
  const company = sections.find((section) => section.heading.startsWith("company"))?.body ?? "";
  const role = [preface, sections.find((section) => section.heading.startsWith("role"))?.body ?? ""].filter(Boolean).join("\n\n");
  return { company, role };
}

/** Turn pasted requirements copy into unordered-list items without inventing extra bullets. */
export function toBulletItems(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const lines = trimmed
    .split(/\r?\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•●]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  const single = lines[0] ?? trimmed;
  const parts = single.split(/\s*[;•●]\s+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [single];
}
