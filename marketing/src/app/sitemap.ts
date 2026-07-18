import type { MetadataRoute } from "next";
import { canonical, PUBLIC_ROUTES } from "@/lib/site";

/** Canonical public pages only — private/app routes must never appear.
 * lastModified is the build date, which is accurate for a fully static
 * site: content only changes when the site is rebuilt and redeployed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const buildDate = new Date();
  return PUBLIC_ROUTES.map((path) => ({
    url: canonical(path),
    lastModified: buildDate,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
