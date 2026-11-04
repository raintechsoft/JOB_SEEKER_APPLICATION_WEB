import {z} from "zod";
import type {HttpClient} from "../api/client";
import {createPublicBrowsingQueries} from "./public-browsing.service";

const envelope=z.object({data:z.unknown()}).strict();
export function createHttpPublicBrowsingService(http:HttpClient){
  const data=(value:unknown)=>envelope.parse(value).data;
  return createPublicBrowsingQueries({
    async refresh(ids,filter,options){return data(await http.get("public/feed/refresh",{ids:ids.join(','),filter},options));},
    async feed(query,options){return data(await http.get("public/feed",query,options));},
    async entry(id,options){return data(await http.get(`public/feed/${id}`,undefined,options));},
    async comments(id,query,options){return data(await http.get(`public/feed/${id}/comments`,query,options));},
    async search(query,options){return data(await http.get("public/search",query,options));},
  });
}
