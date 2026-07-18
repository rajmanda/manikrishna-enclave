import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Crawler policy for the PUBLIC marketing site only. The authenticated
 * application is a separate deployment with its own deny-all robots.txt;
 * its privacy is enforced by authentication and server-side authorization,
 * never by robots rules.
 *
 * Policy (see docs/NIVAASOS_PUBLIC_SITE.md):
 * - All public marketing pages are open to search crawlers and to
 *   search/user-directed AI crawlers (OAI-SearchBot, ChatGPT-User,
 *   Claude-SearchBot, Claude-User).
 * - TRAINING crawlers (GPTBot, ClaudeBot, etc.) are an open business
 *   decision for the owner and are intentionally NOT configured yet —
 *   absent rules mean they follow `*` (allowed). Add explicit directives
 *   once the owner decides. Verify current official crawler names before
 *   deploying changes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "Claude-SearchBot", allow: "/" },
      { userAgent: "Claude-User", allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
