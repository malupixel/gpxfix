export function publicSiteUrl(): URL {
  const url = new URL(process.env.SITE_URL ?? "https://tweakmyroute.com");
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error("SITE_URL must be a public HTTP(S) origin without a path or credentials");
  }
  return url;
}
