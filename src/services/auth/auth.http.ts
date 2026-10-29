import type { HttpClient } from "../api/client";
import { ApiError } from "../api/client";
import type { AuthService, AuthSession, Challenge } from "./auth.service";

export function createHttpAuthService(http: HttpClient, onSessionChange: () => void = () => {}, onBound:(session:AuthSession)=>void=()=>{}): AuthService {
  const get = async <T>(path: string) => (await http.get<{ data: T }>(path)).data;
  const post = async <T>(path: string, body?: unknown) => (await http.post<{ data: T }>(path, body)).data;
  let observed: {user:string;workspace:string|null}|null=null;
  let sessionEpoch=0;
  let pendingSession:Promise<AuthSession>|null=null;
  const resetReads=()=>{sessionEpoch++;pendingSession=null;};
  const changed=()=>new ApiError("Workspace context changed.",412,{message:"Your account workspace changed. Reload this page before continuing."});
  const bind = (session: AuthSession) => { const changed=!observed||observed.user!==session.user.id||observed.workspace!==session.selected_identity_id;http.setUserContext(session.user.id); observed={user:session.user.id,workspace:session.selected_identity_id};if(changed)onBound(session);return session; };
  const authenticate=async(action:()=>Promise<AuthSession>)=>{resetReads();const result=await action();resetReads();onSessionChange();observed=null;return bind(result);};
  const signOut=async(action:()=>Promise<unknown>)=>{resetReads();await action();resetReads();http.setUserContext(null);observed=null;onSessionChange();};
  return {
    login: (input, portal = "professional") => authenticate(()=>post<AuthSession>(portal === "admin" ? "auth/login" : `auth/${portal}/login`, input)),
    register: (input) => authenticate(()=>post<AuthSession>("auth/register", input)),
    me: () => {
      if(pendingSession)return pendingSession;
      const epoch=sessionEpoch;
      const read=get<AuthSession>("auth/me").then((session)=>{if(epoch!==sessionEpoch||observed&&(observed.user!==session.user.id||observed.workspace!==session.selected_identity_id))throw changed();return bind(session);}).finally(()=>{if(pendingSession===read)pendingSession=null;});
      pendingSession=read;return read;
    },
    logout: () => signOut(()=>http.post("auth/logout")),
    forgot: (input) => post<Challenge>("auth/forgot-password", input),
    recovery: () => get("auth/recovery"),
    recoveryNavigation: (screen) => http.post("auth/recovery/navigation", { screen }),
    verifyReset: (input) => http.post("auth/reset-password/verify", input),
    reset: (input) => signOut(()=>http.post("auth/reset-password", input)),
    changePassword: (input) => signOut(()=>http.patch("auth/password", input)),
    requestEmailCode: () => post("auth/email/challenge"),
    verifyEmail: (input) => post("auth/email/verify", input),
    selectWorkspace: (id) => authenticate(()=>post<AuthSession>("me/workspace", { identity_id: id })),
    startEmployer: (input) => post("registration-intents", input),
    employerDetails: async (id, input) => (await http.patch<{ data: Awaited<ReturnType<AuthService["employerDetails"]>> }>(`registration-intents/${encodeURIComponent(id)}/details`, input)).data,
    employerResend: (id, kind) => post(`registration-intents/${encodeURIComponent(id)}/challenge`, { kind }),
    employerVerify: (id, input) => http.post(`registration-intents/${encodeURIComponent(id)}/verify`, input),
    employerFinalize: (id, input) => authenticate(()=>post<AuthSession>(`registration-intents/${encodeURIComponent(id)}/finalize`, input)),
    completeExternalSignIn: () => authenticate(()=>get<AuthSession>("auth/me")),
    acceptInvitation: (token) => post("invitations/accept", { token }),
    organization: (id) => get(`organizations/${encodeURIComponent(id)}`),
    invite: async (id, input) => { await http.post(`organizations/${encodeURIComponent(id)}/invitations`, input); },
    updateMember: (organization, member, input) => http.patch(`organizations/${encodeURIComponent(organization)}/members/${encodeURIComponent(member)}`, input),
  };
}
