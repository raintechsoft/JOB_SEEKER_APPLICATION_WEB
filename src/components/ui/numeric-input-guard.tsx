"use client";

import { useEffect } from "react";

/**
 * Characters each numeric field accepts. Number fields allow a decimal point only when their step
 * permits fractions and a minus sign only when their minimum is negative; browsers otherwise let
 * "e", "E" and "+" through. Phone fields keep the usual dialling symbols.
 */
function allowedPattern(input: HTMLInputElement): RegExp | null {
  if (input.type === "number") {
    const step = input.getAttribute("step");
    const decimal = step === "any" || (step !== null && step !== "" && !Number.isInteger(Number(step)));
    const negative = input.min !== "" && Number(input.min) < 0;
    return new RegExp(`^[0-9${decimal ? "." : ""}${negative ? "\\-" : ""}]$`);
  }
  if (input.type === "tel") return /^[0-9+\-\s()]$/;
  if (input.inputMode === "numeric") return /^[0-9]$/;
  if (input.inputMode === "decimal") return /^[0-9.-]$/;
  return null;
}

/** One document-level guard so every numeric field in the app accepts only numeric input. */
export function NumericInputGuard() {
  useEffect(() => {
    const target = (event: Event) => (event.target instanceof HTMLInputElement ? event.target : null);
    const keydown = (event: KeyboardEvent) => {
      const input = target(event);
      if (!input || event.ctrlKey || event.metaKey || event.altKey || typeof event.key !== "string" || event.key.length !== 1) return;
      const pattern = allowedPattern(input);
      if (pattern && !pattern.test(event.key)) event.preventDefault();
    };
    const paste = (event: ClipboardEvent) => {
      const input = target(event);
      const pattern = input && allowedPattern(input);
      if (!input || !pattern) return;
      const text = event.clipboardData?.getData("text") ?? "";
      const kept = [...text].filter((char) => pattern.test(char)).join("");
      if (kept === text) return;
      // Paste only the allowed characters; go through the native setter so React sees the change.
      event.preventDefault();
      if (!kept) return;
      const start = input.selectionStart, end = input.selectionEnd;
      const next = start !== null && end !== null ? input.value.slice(0, start) + kept + input.value.slice(end) : input.value + kept;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("paste", paste, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("paste", paste, true);
    };
  }, []);
  return null;
}
