"use client";

import {useState} from "react";
import {Button} from "@/components/ui/button";
import {modal} from "@/stores/modal-store";

export function ApplicationExitDialog({save,discard,leave}:{save:()=>Promise<boolean>;discard:()=>void;leave:()=>void}) {
  const [busy,setBusy]=useState(false);
  return <div className="stack"><p>You have unsaved changes. Save them before leaving?</p><div className="row wrap">
    <Button disabled={busy} onClick={()=>modal.close()}>Keep editing</Button>
    <Button disabled={busy} onClick={()=>{discard();modal.close();leave();}}>Leave without saving</Button>
    <Button variant="primary" disabled={busy} onClick={async()=>{setBusy(true);try{const ok=await save();modal.close();if(ok)leave();}finally{setBusy(false);}}}>Save and leave</Button>
  </div></div>;
}
