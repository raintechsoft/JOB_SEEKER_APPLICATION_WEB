import {z} from "zod";
import searchPolicy from "../../../contracts/validation/global-search.json";
import {publicCommentsPageSchema,publicCommentsQuerySchema,publicEntryIdSchema,publicEntrySchema,publicFeedPageSchema,publicFeedQuerySchema,publicSearchPageSchema,publicSearchQuerySchema,type PublicCommentsQuery,type PublicFeedQuery,type PublicSearchQuery} from "@/lib/validation/public-browsing";

export type PublicReadOptions={signal?:AbortSignal};
/** Public-only reads; never resolve a workspace or load account-specific data. */
export interface PublicBrowsingTransport {
  feed(query:PublicFeedQuery,options?:PublicReadOptions):Promise<unknown>;
  entry(id:string,options?:PublicReadOptions):Promise<unknown>;
  comments(id:string,query:PublicCommentsQuery,options?:PublicReadOptions):Promise<unknown>;
  search(query:PublicSearchQuery,options?:PublicReadOptions):Promise<unknown>;
  refresh?(ids:string[],filter:PublicFeedQuery["filter"],options?:PublicReadOptions):Promise<unknown>;
}
export function createPublicBrowsingQueries(transport:PublicBrowsingTransport){
  return {
    async refresh(ids:string[],filter:PublicFeedQuery["filter"],options?:PublicReadOptions){
      z.array(publicEntryIdSchema).max(1000).refine(values=>new Set(values).size===values.length).parse(ids);
      publicFeedQuerySchema.parse({filter});
      if(!transport.refresh)throw new Error("Live feed refresh is unavailable.");
      const entries:z.output<typeof publicEntrySchema>[]=[];
      for(let start=0;start<ids.length;start+=40){const batch=ids.slice(start,start+40),rows=z.array(publicEntrySchema).max(40).parse(await transport.refresh(batch,filter,options));if(rows.some(row=>!batch.includes(row.id)))throw new Error("Unexpected refreshed entry.");entries.push(...rows);}
      return entries;
    },
    async feed(input:unknown={},options?:PublicReadOptions){const query=publicFeedQuerySchema.parse(input);return publicFeedPageSchema.parse(await transport.feed(query,options));},
    async entry(input:unknown,options?:PublicReadOptions){const id=publicEntryIdSchema.parse(input);const entry=publicEntrySchema.parse(await transport.entry(id,options));if(entry.id!==id)throw new Error("The public entry response does not match the requested resource.");return entry;},
    async comments(input:unknown,values:unknown={},options?:PublicReadOptions){const id=publicEntryIdSchema.parse(input),query=publicCommentsQuerySchema.parse(values);const result=publicCommentsPageSchema.parse(await transport.comments(id,query,options));if(result.items.some(item=>item.entryId!==id))throw new Error("The public comments do not belong to this entry.");return result;},
    async search(input:unknown,options?:PublicReadOptions){const query=publicSearchQuerySchema.parse(input);const result=publicSearchPageSchema.parse(await transport.search(query,options));const kinds=searchPolicy.selectionKinds[query.scope] as string[];if(result.scope!==query.scope||result.items.some(item=>!kinds.includes(item.kind)))throw new Error("The public search response does not match its category.");return result;},
  };
}
export type PublicFeedEntry=z.output<typeof publicEntrySchema>;
export type PublicBrowsingService=ReturnType<typeof createPublicBrowsingQueries>;
