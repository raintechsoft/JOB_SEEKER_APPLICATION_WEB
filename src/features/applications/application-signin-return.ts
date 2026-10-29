import {applicationSignInReturn} from "./application-wizard-policy";

const key="skillora.application.signin-return";
/** API authentication changes cookies outside Next's route cache. Re-enter the guarded route freshly. */
export function navigateToApplication(value:string) {
  const target=applicationSignInReturn(value);
  if(!target)throw new Error("Invalid application return destination.");
  window.location.assign(target);
}
/** Only an allowlisted public destination, never contact/form values or a verification code. */
export function rememberApplicationSignInReturn(value:string|null) {
  try {
    const target=applicationSignInReturn(value);
    if(target)sessionStorage.setItem(key,JSON.stringify({target,expiresAt:Date.now()+15*60*1000}));
    else sessionStorage.removeItem(key);
  } catch { /* Returning to the normal workspace is safe if browser storage is unavailable. */ }
}
export function takeApplicationSignInReturn():string|null {
  try {
    const raw=sessionStorage.getItem(key);sessionStorage.removeItem(key);
    const stored=raw?JSON.parse(raw):null;
    return stored&&typeof stored.expiresAt==="number"&&stored.expiresAt>Date.now()?applicationSignInReturn(stored.target):null;
  } catch { return null; }
}
