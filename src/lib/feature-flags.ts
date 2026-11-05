/** True only when the named NEXT_PUBLIC_* flag is the string "true". */
const on = (name: string) => process.env[name] === "true";

/** Temporary: hide invite/add-recruiter UI until invitations are ready to ship. */
export const RECRUITER_INVITES_ENABLED = on("NEXT_PUBLIC_RECRUITER_INVITES_ENABLED");

/** Temporary: hide Compare Candidates UI until the feature is ready to ship again. */
export const COMPARE_CANDIDATES_ENABLED = on("NEXT_PUBLIC_COMPARE_CANDIDATES_ENABLED");

/** Temporary: hide Team and workspace access until that settings surface is ready again. */
export const TEAM_WORKSPACE_ACCESS_ENABLED = on("NEXT_PUBLIC_TEAM_WORKSPACE_ACCESS_ENABLED");

/** Temporary: hide job-wizard “Create from a template” until that assistant ships. */
export const JOB_TEMPLATE_CREATE_ENABLED = on("NEXT_PUBLIC_JOB_TEMPLATE_CREATE_ENABLED");

/** Temporary: hide response-centre Keyword matching until that filter ships. */
export const RESPONSE_KEYWORD_MATCHING_ENABLED = on("NEXT_PUBLIC_RESPONSE_KEYWORD_MATCHING_ENABLED");
