"use client";
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { getRouteActivity, type RouteActivity } from "./api";
import { routeVersionPath, publicRoutePath } from "./route-links";
import { RouteDialog } from "./route-dialog";

export function activityLink(routeId: string, event: RouteActivity): string | null {
  const path = event.versionNumber ? routeVersionPath(routeId, event.versionNumber) : publicRoutePath(routeId);
  if (event.suggestionPublicId) return `${path}?suggestion=${encodeURIComponent(event.suggestionPublicId)}${event.commentPublicId ? `#comment-${encodeURIComponent(event.commentPublicId)}` : ""}`;
  return event.versionNumber ? path : null;
}
function activityIcon(type: string) {
  if (type.startsWith("COMMENT_")) return "☷";
  if (type.startsWith("SUGGESTION_")) return type === "SUGGESTION_MERGED" ? "↗" : "◆";
  if (type === "METADATA_UPDATED") return "✎";
  if (type.startsWith("SUGGESTIONS_")) return "☰";
  return "+";
}
function Events({ routeId, items }: { routeId: string; items: RouteActivity[] }) {
  const { t, i18n } = useTranslation();
  return <ol className="space-y-3">{items.map(event => {
    const link = activityLink(routeId, event);
    const actor = event.actorName ?? t(event.actorKind === "OWNER" ? "routeActivity.owner" : "routeActivity.contributor");
    const text = t(`routeActivity.events.${event.type}`, { actor, version: event.versionNumber });
    return <li key={event.id} className="flex gap-3 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0"><span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">{activityIcon(event.type)}</span><div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]"><div>{link ? <Link href={link} className="font-medium text-slate-800 hover:text-emerald-700 hover:underline">{text}</Link> : <span className="font-medium">{text}</span>}</div><time dateTime={event.occurredAt} className="text-xs text-slate-500">{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt))}</time></div></li>;
  })}</ol>;
}
export function RouteActivityCard({ routeId, isOwner }: { routeId: string; isOwner: boolean }) {
  const { t } = useTranslation(); const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ["route-activity", routeId, isOwner, "recent"], queryFn: () => getRouteActivity(routeId, isOwner), staleTime: 0 });
  return <section className="route-card p-5 sm:p-6"><div className="mb-4 flex justify-between gap-3"><h2 className="text-lg font-bold">{t("info.recentActivity")}</h2><button onClick={() => setOpen(true)} className="text-xs font-medium text-slate-800 hover:text-emerald-700 hover:underline">{t("info.viewAll")}</button></div>
    {query.isPending ? <p role="status">{t("routeActivity.loading")}</p> : query.isError ? <div role="alert"><p>{t("routeActivity.failed")}</p><button onClick={() => void query.refetch()} className="route-button mt-2">{t("pages.retry")}</button></div> : !query.data.items.length ? <p>{t("routeActivity.empty")}</p> : <Events routeId={routeId} items={query.data.items} />}
    {open && <ActivityHistory routeId={routeId} isOwner={isOwner} onClose={() => setOpen(false)} />}
  </section>;
}
function ActivityHistory({ routeId, isOwner, onClose }: { routeId: string; isOwner: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const query = useInfiniteQuery({ queryKey: ["route-activity", routeId, isOwner, "history"], initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => getRouteActivity(routeId, isOwner, 20, pageParam), getNextPageParam: page => page.nextCursor ?? undefined, staleTime: 0 });
  const items = query.data?.pages.flatMap(page => page.items) ?? [];
  return <RouteDialog title={t("routeActivity.history")} onClose={onClose}>
    {query.isPending && <p role="status">{t("routeActivity.loading")}</p>}
    {query.isError && <div role="alert"><p>{t("routeActivity.failed")}</p><button onClick={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())} className="route-button mt-2">{t("pages.retry")}</button></div>}
    {!query.isPending && !query.isError && !items.length && <p>{t("routeActivity.empty")}</p>}
    <Events routeId={routeId} items={items} />
    {query.hasNextPage && <button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} className="route-button mt-4 w-full">{t(query.isFetchingNextPage ? "routeActivity.loading" : "routeActivity.loadMore")}</button>}
  </RouteDialog>;
}
