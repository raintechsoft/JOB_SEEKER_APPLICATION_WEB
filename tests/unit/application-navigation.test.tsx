import {act,cleanup,fireEvent,renderHook} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {useApplicationNavigation} from "@/features/applications/application-navigation";
import {applicationHistoryScript} from "@/features/applications/application-history-bootstrap";

const path="/app/jobs/10000000-0000-4000-8000-000000000001/apply?step=contact";
beforeEach(()=>{new Function(applicationHistoryScript)();window.history.replaceState({editor:true},"",path);});
afterEach(()=>cleanup());

it("requests a single app leave decision and suppresses normal link navigation while dirty",()=>{
  const leave=vi.fn(),navigate=vi.fn();
  const hook=renderHook(()=>useApplicationNavigation({dirty:true,busy:false,onLeave:leave,onStep:vi.fn(),navigate}));
  const anchor=document.createElement("a");anchor.href="/app/jobs";document.body.append(anchor);
  const event=new MouseEvent("click",{bubbles:true,cancelable:true,button:0});
  act(()=>{anchor.dispatchEvent(event);});
  expect(event.defaultPrevented).toBe(true);expect(leave).toHaveBeenCalledWith("/app/jobs");expect(navigate).not.toHaveBeenCalled();
  act(()=>hook.result.current("/app/jobs"));expect(navigate).toHaveBeenCalledWith("/app/jobs");
  const unload=new Event("beforeunload",{cancelable:true});window.dispatchEvent(unload);expect(unload.defaultPrevented).toBe(false);anchor.remove();
});
it("uses native reload confirmation, and blocks leaving while a save is pending without opening another dialog",()=>{
  const leave=vi.fn();renderHook(()=>useApplicationNavigation({dirty:true,busy:true,onLeave:leave,onStep:vi.fn(),navigate:vi.fn()}));
  const unload=new Event("beforeunload",{cancelable:true});window.dispatchEvent(unload);expect(unload.defaultPrevented).toBe(true);
  const anchor=document.createElement("a");anchor.href="/app/dashboard";document.body.append(anchor);fireEvent.click(anchor);
  expect(leave).not.toHaveBeenCalled();anchor.remove();
});
it("restores the editor on dirty browser Back before presenting the leave decision",()=>{
  const leave=vi.fn();renderHook(()=>useApplicationNavigation({dirty:true,busy:false,onLeave:leave,onStep:vi.fn(),navigate:vi.fn()}));
  window.history.pushState({target:true},"","/app/search?q=other");
  act(()=>{window.dispatchEvent(new PopStateEvent("popstate",{state:{target:true}}));});
  expect(window.location.pathname+window.location.search).toBe(path);
  expect(leave).toHaveBeenCalledWith("/app/search?q=other");
});
it("keeps same-page step navigation separate from leaving and lets the editor clamp progress",()=>{
  const step=vi.fn(),leave=vi.fn();renderHook(()=>useApplicationNavigation({dirty:true,busy:false,onLeave:leave,onStep:step,navigate:vi.fn()}));
  window.history.replaceState(null,"",path.replace("contact","review"));
  act(()=>window.dispatchEvent(new PopStateEvent("popstate")));
  expect(step).toHaveBeenCalledWith("review");expect(leave).not.toHaveBeenCalled();
});

it("checks dirty state before an already-mounted router can consume browser Back",()=>{
  const router=vi.fn(),leave=vi.fn();window.addEventListener("popstate",router);
  const hook=renderHook(()=>useApplicationNavigation({dirty:true,busy:false,onLeave:leave,onStep:vi.fn(),navigate:vi.fn()}));
  window.history.pushState(null,"","/app/jobs");
  act(()=>window.dispatchEvent(new PopStateEvent("popstate")));
  expect(leave).toHaveBeenCalledTimes(1);expect(router).not.toHaveBeenCalled();
  hook.unmount();window.removeEventListener("popstate",router);
});

it("leaves normal clean-page history navigation available to the existing router",()=>{
  const router=vi.fn(),leave=vi.fn();window.addEventListener("popstate",router);
  const hook=renderHook(()=>useApplicationNavigation({dirty:false,busy:false,onLeave:leave,onStep:vi.fn(),navigate:vi.fn()}));
  window.history.pushState(null,"","/app/jobs");
  act(()=>window.dispatchEvent(new PopStateEvent("popstate")));
  expect(router).toHaveBeenCalledTimes(1);expect(leave).not.toHaveBeenCalled();
  hook.unmount();window.removeEventListener("popstate",router);
});
