import type {components} from "@/types/generated/api";
export type NotificationPreference=components["schemas"]["NotificationPreference"];
export interface NotificationsService {
 list():Promise<components["schemas"]["Notifications"]>;
 markRead(id:string):Promise<void>;
 preferences():Promise<NotificationPreference[]>;
 savePreference(value:NotificationPreference):Promise<void>;
}
