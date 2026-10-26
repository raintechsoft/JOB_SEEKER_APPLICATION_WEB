"use client";

import { useState } from "react";
import type { Role } from "@/types/domain";
import { Avatar, Button } from "@/components/ui/primitives";
import { useServiceQuery } from "@/hooks/use-services";
import { useFormAction } from "@/hooks/use-form-action";
import { toast } from "@/stores/toast-store";

export function BlockedAccounts({ role }: { role: Role }) {
  const query = useServiceQuery(["blocked-accounts", role], s => s.feed.getBlocked(role));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  return <div className="stack">
    <p>Blocked accounts cannot message you or interact with your feed in this workspace. Unblocking does not restore follows.</p>
    {errors._form && <p role="alert" className="error">{errors._form}</p>}
    {query.isError && <p role="alert">Blocked accounts could not be loaded. <Button onClick={() => void query.refetch()}>Try again</Button></p>}
    {query.data?.length === 0 && <p>You haven’t blocked any accounts.</p>}
    {query.data?.map(target => <div className="row between" key={target.identityId}><div className="row gap8"><Avatar person={target.person} /><strong>{target.person.name}</strong></div><Button variant="sm" disabled={pending} onClick={async () => {
      setErrors({});
      const result = await execute(s => s.feed.unblock(role, target.identityId), { invalidate: ["blocked-accounts", "feed", "feed-entry", "feed-comments", "network", "people-search", "workspace-search", "messaging", "messages", "inbox"] });
      if (result) toast("Account unblocked.");
    }}>Unblock {target.person.name}</Button></div>)}
  </div>;
}
