"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServices } from "@/hooks/use-services";
import { quickMessageSchema } from "@/lib/validation/communication";
import contract from "../../../contracts/validation/communication.json";
import { ApiError, errorMessage } from "@/services/api/client";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Button } from "@/components/ui/primitives";
import { TextAreaField } from "@/components/ui/field";

/** Start a conversation with a person without leaving the discovery page. */
export function QuickMessage({ candidateId, name, role = "recruiter" }: { candidateId: string; name: string; role?: "recruiter" | "professional" }) {
  const services = useServices();
  const cache = useQueryClient();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const parsed = quickMessageSchema.safeParse(text);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Write a message.");
    setError("");
    setPending(true);
    try {
      const conversation = await services.messaging.start(role, candidateId, { anyCompany: true });
      if (!conversation) throw new Error("The conversation could not be opened. Please try again.");
      const sent = await services.messaging.send(role, conversation, parsed.data, []);
      if (!sent) throw new Error("Your message could not be sent. Please try again.");
      await cache.invalidateQueries({ queryKey: ["messaging"] });
      modal.close();
      toast("Message sent to " + name + ".");
    } catch (e) {
      setError(e instanceof ApiError || !(e instanceof Error) ? errorMessage(e) : e.message);
    } finally {
      setPending(false);
    }
  };
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <TextAreaField label={"Message to " + name} name="message" value={text} maxLength={contract.messageMax} rows={5} required autoFocus onChange={(e) => setText(e.target.value)} error={error || undefined} />
      <p className="small muted">They’ll see this in their Skillora messages. You can continue the conversation from Messages.</p>
      <div className="row between">
        <Button variant="text" onClick={() => modal.close()} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" icon="send" disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
