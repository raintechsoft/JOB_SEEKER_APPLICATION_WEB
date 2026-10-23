"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { shortlistNameSchema } from "@/lib/validation/application";
import { validationFields } from "@/lib/validation/profile";
import { useFormAction } from "@/hooks/use-form-action";
import type { Id,Shortlist } from "@/types/domain";
import type {ShortlistView} from "@/services/talent/talent.service";
import { firstName } from "@/lib/utils/text";
import { devCopy } from "@/lib/env/app-env";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Avatar, Button } from "@/components/ui/primitives";
import { TextField,SelectField } from "@/components/ui/field";
import { confirmAction, FormError } from "@/components/ui/feedback";
import { QueryFeedback } from "@/components/ui/query-view";



function ShortlistChooser({ candidateId }: { candidateId: Id }) {
  const {data,isError,refetch}=useServiceQuery(["shortlists"],(s)=>s.talent.listShortlists(),{keepPreviousData:false});
  return data?<ShortlistSelection candidateId={candidateId} initialLists={data}/>:<QueryFeedback data={data} error={isError} retry={refetch} label="Loading shortlists" />;
}
function ShortlistSelection({candidateId,initialLists}:{candidateId:Id;initialLists:ShortlistView[]}){
  const [lists]=useState(initialLists);
  const [errors,setErrors]=useState<Record<string,string>>({});
  const {execute,pending}=useFormAction(setErrors);
  const dialogs = useShortlistDialogs();
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
          const versions=Object.fromEntries(lists.filter((l)=>l.canEdit!==false && typeof l.version==="number").map((l)=>[l.id,l.version!]));
          if(!await execute(async(s)=>{await s.talent.setCandidateShortlists(candidateId, ids,versions);return true;}))return;
          toast("Shortlists updated.");
          modal.close();
        }}
      >
        {lists.length ? (
          lists.map((s) => (
            <label className="check-row" key={s.id}>
              <input name="shortlist" type="checkbox" value={s.id} defaultChecked={s.candidates.includes(candidateId)} disabled={s.canEdit===false} />
              {s.name} <span className="tag">{s.candidates.length}</span>
            </label>
          ))
        ) : (
          <p className="small muted">Create a shortlist first to save candidates.</p>
        )}
        {Object.values(errors).map((error)=><p role="alert" key={error}>{error}</p>)}
        <div className="modal-footer">
          <Button icon="plus" onClick={() => dialogs.edit()}>
            New shortlist
          </Button>
          <Button type="submit" variant="primary" loading={pending} disabled={pending}>
            Save selection
          </Button>
        </div>
      </form>
    </>
  );
}

function ShortlistNameForm({ id, name,version }: { id?: Id; name?: string;version?:number }) {
  const [errors,setErrors]=useState<Record<string,string>>({});
  const {execute,pending}=useFormAction(setErrors);
  const setUi = useUiStore((s) => s.setUi);
  return (
    <form
      id="shortlist-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get("name") || "").trim();
        const checked=shortlistNameSchema.safeParse(value);
        if(!checked.success)return setErrors(validationFields(checked.error));
        if(!await execute(async(s)=>{if(id)await s.talent.renameShortlist(id,checked.data,version);else setUi({shortlistTab:await s.talent.createShortlist(checked.data)});}))return;
        toast(id ? "Shortlist renamed." : "Your new shortlist is ready.");
        modal.close();
      }}
    >
      {Object.values(errors).map((error)=><p role="alert" key={error}>{error}</p>)}
      <TextField label="Shortlist name" name="name" defaultValue={name ?? ""} required minLength={1} maxLength={100} placeholder="e.g. Product design team" />
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" loading={pending} disabled={pending}>
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
      <p className="small muted">{devCopy("Choose 2–4 fictional professionals to compare.", "Choose 2–4 professionals to compare.")}</p>
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

function ShortlistSharing({list}:{list:Shortlist}){
  const [errors,setErrors]=useState<Record<string,string>>({});
  const {execute,pending}=useFormAction(setErrors);
  return <form className="stack" onSubmit={async(e)=>{e.preventDefault();const visibility=String(new FormData(e.currentTarget).get("visibility"));if(visibility!=="private"&&visibility!=="organization")return setErrors({visibility:"Choose a sharing option."});if(!await execute(async(s)=>{if(!s.talent.shareShortlist)throw new Error("Sharing is unavailable.");await s.talent.shareShortlist(list.id,{visibility,version:list.version});}))return;modal.close();toast("Shortlist sharing updated.");}}><p>Organization sharing lets active team members view this list. Its owner and organization administrators retain editing access.</p><SelectField label="Who can view this list?" name="visibility" defaultValue={list.visibility??"private"} options={[{value:"private",label:"Owner and administrators"},{value:"organization",label:"Active organization members"}]}/>{Object.values(errors).map((error)=><p role="alert" key={error}>{error}</p>)}<div className="modal-footer"><Button onClick={()=>modal.close()}>Cancel</Button><Button type="submit" variant="primary" loading={pending} disabled={pending}>Save sharing</Button></div></form>;
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
    edit: (id?: Id, name?: string,version?:number) => modal.show(id ? "Rename your shortlist" : "A place for promising people.", <ShortlistNameForm id={id} name={name} version={version}/>),
    share:(list:Shortlist)=>modal.show("Share your shortlist",<ShortlistSharing list={list}/>),
    remove: (id: Id) =>
      confirmAction("Delete this shortlist?", "The list will be removed. Candidate profiles will remain in the directory.", async () => {
        if(!await run(async(s)=>{await s.talent.deleteShortlist(id);return true;}))return;
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
