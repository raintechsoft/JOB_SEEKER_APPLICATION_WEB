import type {components} from "@/types/generated/api";
export type NotificationPreference=components["schemas"]["NotificationPreference"];
export type NotificationRecord=components["schemas"]["NotificationView"];
export interface NotificationsService {
 list():Promise<components["schemas"]["Notifications"]>;
 counts():Promise<components["schemas"]["NotificationCounts"]>;
 markSeen(seenToken:string):Promise<void>;
 delete(id:string):Promise<void>;
 markRead(id:string):Promise<void>;
 preferences():Promise<NotificationPreference[]>;
 savePreference(value:NotificationPreference):Promise<void>;
}
