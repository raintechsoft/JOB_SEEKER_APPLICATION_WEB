/**
 * Temporary surface flag for Portfolio navigation and discovery links.
 * Routes, APIs, application-wizard portfolio steps, and public portfolio pages stay live.
 * Flip NEXT_PUBLIC_PORTFOLIO_UI_ENABLED=true when the section is ready to ship again.
 */
export const portfolioUiEnabled = () =>
  process.env.NEXT_PUBLIC_PORTFOLIO_UI_ENABLED === "true";
