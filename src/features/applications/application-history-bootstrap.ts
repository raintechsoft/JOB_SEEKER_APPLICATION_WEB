export const APPLICATION_HISTORY_EVENT="skillora:application-history";

/** Installed before hydration so Next cannot restore a route before the editor checks it. */
export const applicationHistoryScript=`(()=>{if(window.__skilloraApplicationHistory)return;window.__skilloraApplicationHistory=true;window.addEventListener("popstate",event=>{const check=new CustomEvent(${JSON.stringify(APPLICATION_HISTORY_EVENT)},{cancelable:true,detail:event});window.dispatchEvent(check);if(check.defaultPrevented)event.stopImmediatePropagation();},true);})();`;
