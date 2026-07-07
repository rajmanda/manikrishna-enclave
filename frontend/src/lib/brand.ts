/** Deployment-level branding. The platform is CommunityHub; a single-community
 * deployment (like community.rajmanda.com) sets NEXT_PUBLIC_APP_NAME to show
 * its own name everywhere — no community name is hardcoded in shared code. */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "CommunityHub";
