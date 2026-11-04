"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServices } from "@/hooks/use-services";
import { portfolioSettingsSchema } from "@/lib/validation/portfolio";
import { validationFields } from "@/lib/validation/profile";
import { errorMessage, fieldErrors } from "@/services/api/client";
import type { PortfolioSettingsInput, PortfolioView } from "@/services/portfolio/portfolio.service";

/** Debounce edits and serialize saves; revisions advance only after our confirmed write. */
export function usePortfolioAutosave(view?: PortfolioView | null) {
  const services = useServices(), cache = useQueryClient();
  const revision = useRef<number | undefined>(undefined), busy = useRef(false), queued = useRef<PortfolioSettingsInput | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dirty, setDirty] = useState(false), [pending, setPending] = useState(false), [errors, setErrors] = useState<Record<string, string>>({}), [preview, setPreview] = useState<PortfolioSettingsInput | null>(null);
  const latest = useRef<PortfolioSettingsInput | null>(null);
  const [draftVersion, setDraftVersion] = useState<number | undefined>(undefined);
  const conflict = dirty && !pending && draftVersion !== undefined && view?.config.version !== undefined && draftVersion !== view.config.version;
  useEffect(() => { if (conflict) { if (timer.current) clearTimeout(timer.current); queued.current = null; } }, [conflict]);
  useEffect(() => { if (!dirty && !busy.current) revision.current = view?.config.version; }, [view, dirty]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); queued.current = null; latest.current = null; }, []);
  const validate = (values: PortfolioSettingsInput) => {
    const parsed = portfolioSettingsSchema.safeParse(values);
    if (!parsed.success) { setErrors(validationFields(parsed.error)); return null; }
    return parsed.data;
  };
  const save = async (values: PortfolioSettingsInput): Promise<boolean> => {
    if (conflict) return false;
    const parsed = validate(values); if (!parsed) return false;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    queued.current = parsed;
    if (busy.current) return false;
    busy.current = true; setPending(true);
    let saved: PortfolioSettingsInput | null = null;
    try {
      while (queued.current) {
        const next = queued.current; queued.current = null;
        const result = await services.portfolio.saveSettings({ ...next, version: revision.current ?? view?.config.version });
        if (!result.ok || !result.persisted) throw new Error("The settings could not be saved.");
        revision.current = result.version; setDraftVersion(result.version); saved = next;
      }
      await cache.invalidateQueries({ queryKey: ["portfolio"] });
      const unchanged = !!saved && JSON.stringify(latest.current ?? saved) === JSON.stringify(saved);
      setDirty(!unchanged); if (unchanged) setErrors({});
      return unchanged;
    } catch (error) {
      setErrors({ ...Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, messages]) => [key, messages[0]])), _form: errorMessage(error) });
      queued.current = null; setDirty(true); return false;
    } finally { busy.current = false; setPending(false); }
  };
  const schedule = (values: PortfolioSettingsInput) => {
    if (!dirty) setDraftVersion(view?.config.version);
    setDirty(true); latest.current = values;
    if (timer.current) clearTimeout(timer.current);
    const parsed = validate(values);
    if (!parsed) { queued.current = null; return; }
    setPreview(parsed); setErrors({});
    if (!conflict) timer.current = setTimeout(() => { timer.current = null; void save(parsed); }, 700);
  };
  const reload = () => { if (timer.current) clearTimeout(timer.current); queued.current = null; latest.current = null; revision.current = view?.config.version; setDraftVersion(view?.config.version); setDirty(false); setPreview(null); setErrors({}); };
  return { schedule, save, dirty, pending, conflict, reload, errors, preview: dirty ? preview : null };
}
