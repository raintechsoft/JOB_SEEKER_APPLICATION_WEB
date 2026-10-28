"use client";

import { useState } from "react";
import { useServiceQuery } from "@/hooks/use-services";
import { useFormAction } from "@/hooks/use-form-action";
import { QueryFeedback } from "@/components/ui/query-view";
import { notificationPreferenceSchema } from "@/lib/validation/communication";

const categories = { applications: "Applications", messages: "Messages", job_alerts: "Job alerts" };
const channels = { in_app: "In Skillora", email: "Email", sms: "SMS" };

export function NotificationPreferences() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  const preferences = useServiceQuery(["notification-preferences"], service => service.notifications.preferences());
  return <section className="card form-card notification-settings" aria-labelledby="notification-settings-title">
    <h2 id="notification-settings-title">Notification preferences</h2>
    <p>Choose how you receive application updates, messages, and job alerts.</p>
    {errors._form && <p role="alert" className="error">{errors._form}</p>}
    <QueryFeedback data={preferences.data} error={preferences.isError} retry={preferences.refetch} layout="form" label="Loading notification preferences" />
    {Object.entries(categories).map(([category, label]) => {
      const rows = preferences.data?.filter(preference => preference.category === category);
      return rows?.length ? <fieldset key={category}><legend>{label}</legend><div>{rows.map(preference => <label className="check-row" key={preference.channel}>
        <input type="checkbox" checked={preference.enabled} disabled={pending} onChange={async event => {
          const result = notificationPreferenceSchema.safeParse({ ...preference, enabled: event.target.checked });
          if (!result.success) { setErrors({ _form: result.error.issues[0].message }); return; }
          setErrors({});
          await execute(service => service.notifications.savePreference(result.data), { invalidate: ["notification-preferences", "settings"] });
        }} />{channels[preference.channel]}
      </label>)}</div></fieldset> : null;
    })}
  </section>;
}
