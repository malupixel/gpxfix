export function publicRoutePath(publicId: string, branch?: string): string {
  return `/route/${encodeURIComponent(publicId)}${branch && branch !== "main" ? `?branch=${encodeURIComponent(branch)}` : ""}`;
}

export function publicRouteUrl(publicId: string, origin: string): string {
  return new URL(publicRoutePath(publicId), origin).toString();
}
export function routeVersionPath(publicId:string,version:number,branch?:string):string{return `/route/${encodeURIComponent(publicId)}/v/${version}${branch && branch !== "main" ? `?branch=${encodeURIComponent(branch)}` : ""}`;}

export function managementRouteUrl(publicId: string, token: string, origin: string, branch?: string): string {
  const url = new URL(publicRoutePath(publicId, branch), origin);
  url.searchParams.set("manage", token);
  return url.toString();
}
