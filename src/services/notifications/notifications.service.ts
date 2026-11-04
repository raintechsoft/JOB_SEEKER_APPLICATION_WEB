import type {ReadScope} from "../realtime/realtime.http";
import type {components} from "@/types/generated/api";
export type NotificationPreference=components["schemas"]["NotificationPreference"];
export type NotificationRecord=components["schemas"]["NotificationView"];
export interface NotificationsService {
 list(scope?:ReadScope):Promise<components["schemas"]["Notifications"]>;
 counts(scope?:ReadScope):Promise<components["schemas"]["NotificationCounts"]>;
 markSeen(seenToken:string):Promise<void>;
 delete(id:string):Promise<void>;
 /** Soft-delete every visible inbox item for the active identity. */
 clearAll():Promise<void>;
 markRead(id:string):Promise<void>;
 preferences():Promise<NotificationPreference[]>;
 savePreference(value:NotificationPreference):Promise<void>;
}
