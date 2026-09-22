"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { establishRouteOwnership, getRouteOwnerStatus } from "./api";
import { publicRoutePath } from "./route-links";
import type { RouteData } from "@/types/route";
import { RouteHeader } from "./route-header";
import { RoutePageContent } from "./route-page-content";

export function OwnershipGate({ route }: { route: RouteData }) {
  const publicId = route.publicId;
  const params = useSearchParams();
  const router = useRouter();
  const [isOwner, setOwner] = useState(false);

  useEffect(() => {
    let active = true;
    const token = params.get("manage");
    async function resolve() {
      if (token) {
        try {
          await establishRouteOwnership(publicId, token);
          if (active) setOwner(true);
        } catch { if (active) setOwner(false); }
        finally { if (active) router.replace(publicRoutePath(publicId), { scroll: false }); }
      } else if (active) setOwner(await getRouteOwnerStatus(publicId));
    }
    void resolve();
    return () => { active = false; };
  }, [params, publicId, router]);

  return <><RouteHeader route={route} isOwner={isOwner} /><RoutePageContent route={route} /></>;
}
