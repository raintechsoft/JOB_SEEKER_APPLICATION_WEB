import {z} from "zod";
import type {HttpClient} from "../api/client";
import type {components} from "@/types/generated/api";
import type {SettingKey} from "./workspace.service";
type Settings=components["schemas"]["AccountSettings"];
export function createHttpSettingsService(http:HttpClient){let current:Settings|null=null;return {
 reset(){current=null;},
 async getSettings(){current=(await http.get<{data:Settings}>("me/settings")).data;return current;},
 async updateSetting(key:SettingKey,value:boolean){const v=z.object({key:z.enum(["profile-public","portfolio-public","updates-public","notifications"]),value:z.boolean()}).parse({key,value});if(!current)current=(await http.get<{data:Settings}>("me/settings")).data;const version=key==="profile-public"?current.profileVersion:key==="portfolio-public"?current.portfolioVersion:undefined;await http.patch("me/settings",{...v,identityId:current.identityId,...(version?{version}:{})});current=null;return true;},
};}
