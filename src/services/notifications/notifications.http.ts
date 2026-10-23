import {z} from "zod";
import type {HttpClient} from "../api/client";
import type {AuthService} from "../auth/auth.service";
import type {NotificationsService} from "./notifications.service";
import type {components} from "@/types/generated/api";
import {notificationPreferenceSchema} from "@/lib/validation/communication";
import {communicationPath} from "../messaging/messaging.http";
export function createHttpNotificationsService(http:HttpClient,auth:AuthService):NotificationsService{return {
 list:async()=>(await http.get<{data:components["schemas"]["Notifications"]}>(`${await communicationPath(auth)}/notifications`)).data,
 async markRead(id){z.uuid().parse(id);await http.patch(`${await communicationPath(auth)}/notifications/${id}/read`);},
 preferences:async()=>(await http.get<{data:components["schemas"]["NotificationPreference"][]}>("me/notification-preferences")).data,
 async savePreference(value){const v=notificationPreferenceSchema.parse(value);await http.patch("me/notification-preferences",v);},
};}
