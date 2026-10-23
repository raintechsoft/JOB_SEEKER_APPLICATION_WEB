"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {useServiceQuery} from "@/hooks/use-services";
import {useFormAction} from "@/hooks/use-form-action";
import {Button} from "@/components/ui/primitives";
import {QueryFeedback} from "@/components/ui/query-view";
import {notificationPreferenceSchema} from "@/lib/validation/communication";
import {modal} from "@/stores/modal-store";
import {formatLocaleDate} from "@/lib/utils/date";

export function RealNotificationsSheet(){
 const router=useRouter();const [errors,setErrors]=useState<Record<string,string>>({});const {execute,pending}=useFormAction(setErrors);
 const notifications=useServiceQuery(["notifications"],(s)=>s.notifications.list(),{refetchInterval:10000});
 const preferences=useServiceQuery(["notification-preferences"],(s)=>s.notifications.preferences());
 return <div className="stack">
  {errors._form&&<p role="alert" className="error">{errors._form}</p>}
  {notifications.isError?<p role="alert">Notifications could not be loaded. <Button onClick={()=>void notifications.refetch()}>Try again</Button></p>:<>
   <p>{notifications.data?.unreadCount??"—"} unread notifications. Showing the most recent 100.</p>
   <QueryFeedback data={notifications.data} label="Loading notifications" />
   {notifications.data?.items.length?notifications.data.items.map((n)=><article key={n.id} className="card"><strong>{n.title}</strong><p className="small muted">{formatLocaleDate(n.createdAt)} · {n.read?"Read":"Unread"}</p><Button loading={pending} disabled={pending} onClick={async()=>{if(!await execute((s)=>s.notifications.markRead(n.id)))return;modal.close();router.push(n.href);}}>Open notification</Button></article>):notifications.data&&<p>You’re all caught up.</p>}
  </>}
  <details><summary>Notification preferences</summary><div className="stack">
   <QueryFeedback data={preferences.data} error={preferences.isError} retry={preferences.refetch} layout="form" label="Loading notification preferences" />
   {preferences.data?.map((p)=><label className="check-row" key={p.category+":"+p.channel}><input type="checkbox" checked={p.enabled} disabled={pending} onChange={async(e)=>{const v=notificationPreferenceSchema.safeParse({...p,enabled:e.target.checked});if(!v.success){setErrors({_form:v.error.issues[0].message});return;}await execute((s)=>s.notifications.savePreference(v.data));}}/>{({messages:"Messages",applications:"Applications",job_alerts:"Job alerts"})[p.category]} · {({in_app:"In Skillora",email:"Email",sms:"SMS"})[p.channel]}</label>)}
  </div></details>
 </div>;
}
