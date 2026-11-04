import { z } from "zod";
import { ApiError, type HttpClient } from "../api/client";
import type { AuthService } from "../auth/auth.service";
import { createSignalHub, type SignalHub } from "./signal-hub";

export type ReadScope = { signal?: AbortSignal; userId?: string; identityId?: string };
export function createRealtimeService(http: HttpClient, auth: AuthService, hub:SignalHub=createSignalHub()) {
  return {
    hub,
    async portfolio(share:string,socketId?:string){
      z.string().regex(/^[a-f0-9]{64}$/).parse(share);
      if(socketId)z.string().regex(/^\d+\.\d+$/).max(64).parse(socketId);
      return z.object({channel:z.string().regex(/^private-portfolio\.[0-9a-f-]{36}$/),auth:z.string().min(1).max(512).optional()}).strict().parse(await http.post("realtime/portfolio",{share,...(socketId?{socket_id:socketId}:{})}));
    },
    async authorizeAccount(socketId:string,userId:string){
      z.string().regex(/^\d+\.\d+$/).max(80).parse(socketId);z.uuid().parse(userId);
      const session=await auth.me();if(session.user.id!==userId)throw new ApiError("Account changed.",412);
      return z.object({auth:z.string().min(1).max(512)}).strict().parse(await http.post("realtime/auth",{socket_id:socketId,channel_name:`private-account.${userId}`})).auth;
    },
    async authorize(socketId: string, identityId: string, userId: string) {
      z.string().regex(/^\d+\.\d+$/).max(80).parse(socketId);
      z.uuid().parse(identityId); z.uuid().parse(userId);
      const session = await auth.me();
      if (session.user.id !== userId || session.selected_identity_id !== identityId) throw new ApiError("Workspace changed.", 412);
      const result = await http.post<{ auth: string }>("realtime/auth", { socket_id: socketId, channel_name: `private-identity.${identityId}` });
      return z.object({ auth: z.string().min(1).max(512) }).strict().parse(result).auth;
    },
  };
}
