"use client";

import Link from "next/link";
import { useState } from "react";
import type { Role } from "@/types/domain";
import { useServiceQuery } from "@/hooks/use-services";
import { peopleSearchSchema } from "@/lib/validation/social";
import { Avatar, Button } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export function PeopleSearch({ role, query }: { role: Role; query: string }) {
  const [limit, setLimit] = useState(20);
  const parsed = peopleSearchSchema.safeParse({ role, q: query, limit });
  const result = useServiceQuery(["people-search", role, query, limit], s => s.feed.searchPeople(role, query, limit), { enabled: parsed.success, keepPreviousData: false });
  return <section className="card feed-people-search" aria-label="People search results">
    <h2>People</h2>
    {!parsed.success ? <p role="alert">Enter a name or headline using up to 200 characters.</p> : result.isError ? <p role="alert">People could not be loaded. <Button variant="text sm" onClick={() => void result.refetch()}>Try again</Button></p> : !result.data ? <div aria-busy="true" aria-label="People search results"><Skeleton style={{ height: 48 }} /><Skeleton style={{ height: 48 }} /></div> : <>
      <p className="small muted">{result.data.total ? `${result.data.total} matching ${result.data.total === 1 ? "profile" : "profiles"}` : "No matching public profiles. Private or blocked accounts won’t appear here."}</p>
      <ul>
        {result.data.items.map(person => {
          const href = person.recruiter ? `/recruiters/${person.id}` : role === "recruiter" ? `/recruiter/talent/${person.id}` : `/professionals/${person.slug}`;
          return <li key={person.id}><Link href={href} aria-label={`View ${person.name} profile`}><Avatar person={person} /><span><strong>{person.name}</strong>{person.headline && <span>{person.headline}</span>}<small>{person.recruiter ? "Employer" : "Professional"}</small></span></Link></li>;
        })}
      </ul>
      {result.data.nextCursor && (limit < 1000 ? <Button variant="text sm" onClick={() => setLimit(Math.min(1000, limit + 20))}>Show more people</Button> : <p>Narrow your search to see more profiles.</p>)}
    </>}
  </section>;
}
