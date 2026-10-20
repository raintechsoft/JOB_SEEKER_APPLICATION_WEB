"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Id } from "@/types/domain";
import { firstName } from "@/lib/utils/text";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Avatar, Button } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/field";
import { confirmAction, FormError } from "@/components/ui/feedback";

const STORAGE_FALLBACK = "Saved for this page only. Browser storage is full or unavailable.";

function ShortlistChooser({ candidateId }: { candidateId: Id }) {
  const run = useServiceAction();
  const dialogs = useShortlistDialogs();
  const { data: lists } = useServiceQuery(["shortlists"], (s) => s.talent.listShortlists());
  if (!lists) return null;
  return (
    <>
      <p className="small muted">Add or remove this candidate from your named shortlists.</p>
      <form
        id="save-candidate-form"
        className="stack"
        style={{ marginTop: 20 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const ids = new FormData(e.currentTarget).getAll("shortlist").map(String);
          const ok = await run((s) => s.talent.setCandidateShortlists(candidateId, ids));
          if (ok === undefined) return;
          toast(ok ? "Shortlists updated." : STORAGE_FALLBACK);
          modal.close();
        }}
      >
        {lists.length ? (
          lists.map((s) => (
            <label className="check-row" key={s.id}>
              <input name="shortlist" type="checkbox" value={s.id} defaultChecked={s.candidates.includes(candidateId)} />
              {s.name} <span className="tag">{s.candidates.length}</span>
            </label>
          ))
        ) : (
          <p className="small muted">Create a shortlist first to save candidates.</p>
        )}
        <div className="modal-footer">
          <Button icon="plus" onClick={() => dialogs.edit()}>
            New shortlist
          </Button>
          <Button type="submit" variant="primary">
            Save selection
          </Button>
        </div>
      </form>
    </>
  );
}

function ShortlistNameForm({ id, name }: { id?: Id; name?: string }) {
  const run = useServiceAction();
  const setUi = useUiStore((s) => s.setUi);
  return (
    <form
      id="shortlist-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get("name") || "").trim();
        if (id) await run((s) => s.talent.renameShortlist(id, value));
        else {
          const created = await run((s) => s.talent.createShortlist(value));
          if (created) setUi({ shortlistTab: created });
        }
        toast(id ? "Shortlist renamed." : "Your new shortlist is ready.");
        modal.close();
      }}
    >
      <TextField label="Shortlist name" name="name" defaultValue={name ?? ""} required minLength={2} maxLength={60} placeholder="e.g. Product design team" />
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary">
          {id ? "Save name" : "Create shortlist"}
        </Button>
      </div>
    </form>
  );
}

function CompareChooser() {
  const router = useRouter();
  const compared = useUiStore((s) => s.compared);
  const setUi = useUiStore((s) => s.setUi);
  const [error, setError] = useState("");
  const { data: people } = useServiceQuery(["talent", "public-people"], (s) => s.talent.listPublicPeople());
  if (!people) return null;
  return (
    <form
      id="compare-form"
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const ids = new FormData(e.currentTarget).getAll("candidate").map(String);
        if (ids.length < 2 || ids.length > 4) {
          setError("Choose between two and four candidates.");
          return;
        }
        setUi({ compared: ids });
        modal.close();
        router.push("/recruiter/compare");
      }}
    >
      <p className="small muted">Choose 2–4 fictional professionals to compare.</p>
      {people.map((p) => (
        <label className="check-row" key={p.id}>
          <input type="checkbox" name="candidate" value={p.id} defaultChecked={compared.includes(p.id)} />
          <Avatar person={p} />
          <span>
            {p.name} <small className="muted">· {p.headline}</small>
          </span>
        </label>
      ))}
      <div id="compare-error">
        <FormError message={error} />
      </div>
      <div className="modal-footer">
        <Button type="submit" variant="primary">
          Compare candidates
        </Button>
      </div>
    </form>
  );
}

export function useShortlistDialogs() {
  const run = useServiceAction();
  const services = useServices();
  const setUi = useUiStore((s) => s.setUi);
  return {
    choose: async (candidateId: Id) => {
      const candidate = await services.talent.getCandidate(candidateId);
      modal.show("Keep " + firstName(candidate?.person.name ?? "them") + " in mind.", <ShortlistChooser candidateId={candidateId} />);
    },
    edit: (id?: Id, name?: string) => modal.show(id ? "Rename your shortlist" : "A place for promising people.", <ShortlistNameForm id={id} name={name} />),
    remove: (id: Id) =>
      confirmAction("Delete this shortlist?", "The list will be removed. Candidate profiles will remain in the directory.", async () => {
        await run((s) => s.talent.deleteShortlist(id));
        const lists = await services.talent.listShortlists();
        setUi({ shortlistTab: lists[0]?.id ?? null });
        modal.close();
        toast("Shortlist deleted.");
      }),
    chooseCompare: () => modal.show("A little perspective, side by side.", <CompareChooser />),
  };
}

/** Toggles a candidate in the comparison (max four), as the prototype's `compareToggle`. */
export function useCompareToggle() {
  const compared = useUiStore((s) => s.compared);
  const setUi = useUiStore((s) => s.setUi);
  return (id: Id) => {
    if (compared.includes(id)) {
      setUi({ compared: compared.filter((i) => i !== id) });
      toast("Removed from comparison.");
    } else if (compared.length < 4) {
      setUi({ compared: [...compared, id] });
      toast("Added to comparison.");
    } else toast("Compare up to four people at a time.");
  };
}

/** Opens (or creates) a recruiter conversation with a candidate and goes to Messages. */
export function useContactCandidate() {
  const run = useServiceAction();
  const router = useRouter();
  const setMessaging = useUiStore((s) => s.setMessaging);
  return async (candidateId: Id) => {
    const id = await run((s) => s.messaging.start("recruiter", candidateId, { anyCompany: true }));
    if (!id) return;
    setMessaging({ conversation: id });
    modal.close();
    router.push("/recruiter/messages");
  };
}
