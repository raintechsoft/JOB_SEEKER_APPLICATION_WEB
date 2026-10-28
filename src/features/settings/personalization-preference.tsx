"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { QueryFeedback } from "@/components/ui/query-view";
import { Button } from "@/components/ui/primitives";
import { errorMessage } from "@/services/api/client";
import { toast } from "@/stores/toast-store";
import type { PersonalizationSettings } from "@/services/personalization/personalization.service";
import { downloadBlob } from "@/lib/utils/files";

const CHOICES: { key: keyof PersonalizationSettings; title: string; description: string }[] = [
  { key: "personalize", title: "Personalise with my activity", description: "Use what you view, read, save, like and search to tailor your feed, jobs and search. When off, nothing is recorded and recommendations use only your profile, who you follow and what you marked “Not interested”." },
  { key: "searchHistory", title: "Save search history", description: "Keep your recent searches so you can repeat them and get better suggestions. When off, searches are not stored." },
];

/** F12: account-wide personalisation choices and clearing the history behind them (both roles). */
export function PersonalizationPreference() {
  const services = useServices();
  const queryClient = useQueryClient();
  const query = useServiceQuery(["personalization"], (s) => s.personalization.get(), { keepPreviousData: false });
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const settings = query.data;

  const save = async (key: keyof PersonalizationSettings, value: boolean) => {
    if (pending) return;
    setPending(key);
    try {
      queryClient.setQueryData(["personalization"], await services.personalization.set(key, value));
      // Recommendations, rail and search suggestions now follow the new choice.
      void queryClient.invalidateQueries({ predicate: (q) => ["recommendations", "feed", "search-suggestions", "similar-jobs"].includes(String(q.queryKey[0])) });
      toast(value ? "Turned on." : "Turned off. Nothing new will be recorded.");
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setPending(null);
    }
  };
  const clear = async () => {
    setPending("clear");
    try {
      await services.personalization.clearHistory();
      void queryClient.invalidateQueries();
      toast("Your activity and search history were deleted.");
      setConfirming(false);
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setPending(null);
    }
  };

  const download = async () => {
    setPending("export");
    try {
      const data = await services.personalization.exportData();
      downloadBlob("skillora-activity-data.json", new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="card form-card personalization-preference" aria-labelledby="personalization-heading">
      <h2 id="personalization-heading">Personalisation</h2>
      <QueryFeedback data={settings} error={query.isError} retry={query.refetch} label="Loading personalisation settings" />
      {settings && (
        <>
          {CHOICES.map(({ key, title, description }) => (
            <label key={key} className="personalization-choice">
              <input type="checkbox" role="switch" checked={settings[key]} disabled={!!pending} aria-describedby={`personalization-${key}`} onChange={(e) => void save(key, e.target.checked)} />
              <span>
                <strong>{title}</strong>
                <small id={`personalization-${key}`}>{description}</small>
              </span>
            </label>
          ))}
          <div className="personalization-clear">
            {confirming ? (
              <>
                <p role="alert">Delete your viewing, reading and search history? Recommendations start again from your profile. Items you marked “Not interested” stay hidden.</p>
                <div className="row">
                  <Button variant="danger" loading={pending === "clear"} disabled={!!pending} onClick={() => void clear()}>Delete history</Button>
                  <Button variant="text" disabled={!!pending} onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              </>
            ) : (
              <div className="row">
                <Button icon="download" loading={pending === "export"} disabled={!!pending} onClick={() => void download()}>Download my data</Button>
                <Button icon="trash" disabled={!!pending} onClick={() => setConfirming(true)}>Clear my activity history</Button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
