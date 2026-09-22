export function publicRoutePath(publicId: string): string {
  return `/route/${encodeURIComponent(publicId)}`;
}

export function publicRouteUrl(publicId: string, origin: string): string {
  return new URL(publicRoutePath(publicId), origin).toString();
}

export function managementRouteUrl(publicId: string, token: string, origin: string): string {
  const url = new URL(publicRoutePath(publicId), origin);
  url.searchParams.set("manage", token);
  return url.toString();
}
