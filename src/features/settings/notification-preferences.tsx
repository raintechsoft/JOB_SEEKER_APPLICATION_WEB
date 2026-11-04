"use client";

import { useState } from "react";
import { useServiceQuery } from "@/hooks/use-services";
import { useFormAction } from "@/hooks/use-form-action";
import { QueryFeedback } from "@/components/ui/query-view";
import { ScreenError } from "@/components/ui/feedback";
import { notificationPreferenceSchema } from "@/lib/validation/communication";

const categories = { applications: "Applications", messages: "Messages", job_alerts: "Job alerts", network: "Network" };
const channels = { in_app: "In Skillora", email: "Email", sms: "SMS" };

export function NotificationPreferences() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  const preferences = useServiceQuery(["notification-preferences"], (service) => service.notifications.preferences());
  return (
    <section className="card form-card notification-settings" aria-labelledby="notification-settings-title">
      <h2 id="notification-settings-title">Notification preferences</h2>
      <p>Choose how you receive application updates, messages, job alerts, and network activity.</p>
      {errors._form && <p role="alert" className="error">{errors._form}</p>}
      {preferences.isError && !preferences.data ? (
        <ScreenError compact error={preferences.error} title="Notification preferences couldn’t load" description="Your saved choices haven’t changed. Please try again." onRetry={() => void preferences.refetch()} />
      ) : (
        <QueryFeedback data={preferences.data} error={preferences.isError} cause={preferences.error} retry={preferences.refetch} layout="form" label="Loading notification preferences" />
      )}
      {Object.entries(categories).map(([category, label]) => {
        const rows = preferences.data?.filter((preference) => preference.category === category);
        return rows?.length ? (
          <fieldset key={category}>
            <legend>{label}</legend>
            <div>
              {rows.map((preference) => (
                <div className="settings-row" key={preference.channel}>
                  <div>
                    <h3>{channels[preference.channel]}</h3>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={preference.enabled}
                      disabled={pending}
                      aria-label={channels[preference.channel]}
                      onChange={async (event) => {
                        const result = notificationPreferenceSchema.safeParse({ ...preference, enabled: event.target.checked });
                        if (!result.success) {
                          setErrors({ _form: result.error.issues[0].message });
                          return;
                        }
                        setErrors({});
                        await execute((service) => service.notifications.savePreference(result.data), { invalidate: ["notification-preferences", "settings"] });
                      }}
                    />
                    <span />
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        ) : null;
      })}
    </section>
  );
}
