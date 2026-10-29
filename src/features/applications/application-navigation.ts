"use client";

import {useEffect, useLayoutEffect, useRef} from "react";
import {APPLICATION_HISTORY_EVENT} from "./application-history-bootstrap";

/** One leave decision for app links/back; the browser owns reload/tab-close confirmation. */
export function useApplicationNavigation({dirty,busy,onLeave,onStep,navigate}:{dirty:boolean;busy:boolean;onLeave:(target:string)=>void;onStep:(step:string|null)=>void;navigate:(target:string)=>void}) {
  const latest = useRef({dirty,busy,onLeave,onStep});
  const approved = useRef(false);
  const current = useRef<{url:string;state:unknown}|null>(null);
  useLayoutEffect(() => {latest.current = {dirty,busy,onLeave,onStep}; current.current = {url:window.location.href,state:window.history.state};});
  useEffect(() => {
    // Next can preserve the editor while it is hidden, then restore its effects.
    // A previous approved exit must not authorize a later visit to leave again.
    approved.current=false;
    const unload = (event:BeforeUnloadEvent) => {
      if (!approved.current && (latest.current.dirty || latest.current.busy)) {event.preventDefault(); event.returnValue="";}
    };
    const click = (event:MouseEvent) => {
      if (approved.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target instanceof Element ? event.target.closest("a[href]") : null) as HTMLAnchorElement|null;
      if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin || target.href === window.location.href || target.pathname === window.location.pathname && target.hash) return;
      if (!latest.current.dirty && !latest.current.busy) return;
      event.preventDefault(); event.stopPropagation();
      if (!latest.current.busy) latest.current.onLeave(target.pathname+target.search+target.hash);
    };
    const pop = (event:Event) => {
      const prior = current.current;
      if (!prior || approved.current) return;
      const previous = new URL(prior.url), target = new URL(window.location.href);
      if (target.pathname === previous.pathname) {
        latest.current.onStep(target.searchParams.get("step"));
        return;
      }
      if (!latest.current.dirty && !latest.current.busy) return;
      event.preventDefault();
      window.history.pushState(prior.state,"",prior.url);
      if (!latest.current.busy) latest.current.onLeave(target.pathname+target.search+target.hash);
    };
    window.addEventListener("beforeunload",unload);
    document.addEventListener("click",click,true);
    window.addEventListener(APPLICATION_HISTORY_EVENT,pop);
    return () => {window.removeEventListener("beforeunload",unload); document.removeEventListener("click",click,true); window.removeEventListener(APPLICATION_HISTORY_EVENT,pop);};
  },[]);
  return (target:string) => {approved.current=true; navigate(target);};
}
