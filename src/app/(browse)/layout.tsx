import type {ReactNode} from "react";
import {BrowseShell} from "@/features/public-browsing/browse-shell";
export default function BrowseLayout({children}:{children:ReactNode}){return <BrowseShell>{children}</BrowseShell>;}
