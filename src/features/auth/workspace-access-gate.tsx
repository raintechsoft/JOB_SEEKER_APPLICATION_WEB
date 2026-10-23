"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useServiceQuery } from "@/hooks/use-services";
import { authDestination } from "./auth-navigation";
import { RealWorkspace } from "./real-workspace";

export function WorkspaceAccessGate({role,children}:{role:"professional"|"recruiter";children:ReactNode}) {
  const router = useRouter();
  const pathname = usePathname();
  const session=useServiceQuery(["auth","session"],(s)=>s.auth.me());
  const data = session.data;
  const selected=data?.workspaces.find((w)=>w.id===data.selected_identity_id);
  const belongs = data?.workspaces.some((workspace) => workspace.kind === role) ?? false;
  const home = data?.user.email_verified && !belongs ? authDestination(data) : null;
  useEffect(() => {
    if (home && pathname !== home) router.replace(home);
  }, [home, pathname, router]);
  if (session.isPending || (home && pathname !== home)) return null;
  if(session.isError||selected?.kind!==role||!data?.user.email_verified)return <RealWorkspace role={role}/>;
  return children;
}
