/**
 * Route-dependent `<body>` classes. About 1,700 prototype CSS rules (including dialog styles) are
 * scoped to `body.professional-theme`, so these must be present before first paint.
 */
export function bodyClassesFor(pathname: string): string[] {
  const path = pathname.replace(/\/$/, "") || "/";
  const classes: string[] = [];
  if (/^\/(app|recruiter|organizations|recruiters)\//.test(path + "/") || ["/login", "/signup", "/employer/login", "/employer/register"].includes(path)) classes.push("professional-theme");
  if (/^\/(app|recruiter)\/messages$/.test(path)) classes.push("messaging-page");
  if (path === "/recruiter/jobs/new") classes.push("job-wizard-page");
  return classes;
}

export const MANAGED_BODY_CLASSES = ["professional-theme", "messaging-page", "job-wizard-page"];

/** Inline script that applies the same classes before React hydrates (prevents a theme flash). */
export const bodyClassScript = `(function(){var p=location.pathname.replace(/\\/$/,"")||"/",c=document.body.classList;if(/^\\/(app|recruiter|organizations|recruiters)\\//.test(p+"/")||["/login","/signup","/employer/login","/employer/register"].indexOf(p)>=0)c.add("professional-theme");if(/^\\/(app|recruiter)\\/messages$/.test(p))c.add("messaging-page");if(p==="/recruiter/jobs/new")c.add("job-wizard-page");})();`;
