import { useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { ModerationStatus, RouteSuggestion, SuggestionComment, SuggestionType } from "@/types/route";
import { addSuggestionComment, getOwnerRouteSuggestions, mergeSuggestion, moderateSuggestion, moderateSuggestionComment } from "./api";
import { canModerateSuggestion } from "./suggestion-lifecycle";
import { apiErrorKey } from "@/i18n/api-errors";
import { routeVersionPath } from "./route-links";
import type { FeedbackProps } from "./route-feedback";

const typeKeys: Record<SuggestionType, string> = { PROBLEM: "suggestion.typeIssue", DETOUR: "suggestion.typeDetour", NOTE: "suggestion.typeNote" };

export function SuggestionDetail(p: FeedbackProps & { suggestion: RouteSuggestion; onBack: () => void }) {
  const { t } = useTranslation();
  const router = useRouter(), queries = useQueryClient();
  const [name, setName] = useState(""), [content, setContent] = useState("");
  const [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const s = p.suggestion;
  const requestKey = useRef<{ key: string; payload: string } | null>(null);
  const refreshActivity = () => void queries.invalidateQueries({ queryKey: ["route-activity", p.routeId] });
  const replace = (next: RouteSuggestion) => { p.onSuggestionsChange(items => items.map(item => item.publicId === next.publicId ? next : item)); refreshActivity(); };

  async function moderate(status: ModerationStatus) {
    if (status === "REJECTED" && !window.confirm(t("lifecycle.rejectConfirm"))) return;
    setBusy(true); setError("");
    try { replace(await moderateSuggestion(p.routeId, s.publicId, status)); }
    catch (caught) { setError(apiErrorKey(caught)); }
    finally { setBusy(false); }
  }
  async function merge() {
    setBusy(true); setError("");
    try { await mergeSuggestion(p.routeId, s.publicId); p.onSuggestionsChange(await getOwnerRouteSuggestions(p.routeId)); refreshActivity(); router.refresh(); }
    catch (caught) { setError(apiErrorKey(caught, "apiErrors.mergeFailed")); }
    finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true);
    try {
      const body = { authorName: name.trim(), content: content.trim() }, payload = JSON.stringify(body);
      if (requestKey.current?.payload !== payload) requestKey.current = { key: crypto.randomUUID(), payload };
      await addSuggestionComment(p.routeId, s.publicId, body, requestKey.current.key);
      requestKey.current = null; refreshActivity(); setName(""); setContent(""); setSent(true);
    } catch (caught) { setError(apiErrorKey(caught, "apiErrors.commentFailed")); }
    finally { setBusy(false); }
  }
  async function moderateComment(comment: SuggestionComment, status: ModerationStatus) {
    setBusy(true);
    try {
      const next = await moderateSuggestionComment(p.routeId, comment.publicId, status);
      replace({ ...s, comments: s.comments.map(item => item.publicId === next.publicId ? next : item), commentCount: s.commentCount + (status === "PUBLISHED" ? 1 : 0) });
    } catch (caught) { setError(apiErrorKey(caught)); }
    finally { setBusy(false); }
  }
  return <aside className="route-card p-4 sm:p-5">
    <button onClick={p.onBack} disabled={busy} className="route-text-action text-sm font-semibold text-emerald-700">← {t("common.back")}</button>
    <div className="mt-3 flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{t(typeKeys[s.type])}</h2>{p.isOwner && <Status value={s.moderationStatus} />}</div>
    <p className="mt-2 text-xs text-slate-500">{t("lifecycle.proposedOn", { version: s.baseVersionNumber })} · km {(s.start.distanceMeters / 1000).toFixed(1)}</p>
    {s.mergedIntoVersionNumber && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{t("lifecycle.mergedInto", { version: s.mergedIntoVersionNumber })}</p>}
    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{s.description}</p>
    <p className="mt-2 break-words text-xs text-slate-500">{s.authorName}</p>
    {p.isOwner && canModerateSuggestion(s) && <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => void moderate("REJECTED")} className="route-button">{t("moderation.reject")}</button><button disabled={busy} onClick={() => void moderate(s.moderationStatus === "PUBLISHED" ? "PENDING" : "PUBLISHED")} className="route-button bg-blue-700 text-white">{t(s.moderationStatus === "PUBLISHED" ? "lifecycle.unpublish" : "moderation.publish")}</button></div>}
    {p.isOwner && !p.readOnly && s.type === "DETOUR" && s.moderationStatus === "PUBLISHED" && s.integrationStatus === "NOT_MERGED" && <button disabled={busy} onClick={() => void merge()} className="route-button mt-4 w-full bg-emerald-700 text-white">{t("lifecycle.merge")}</button>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{t(error)}</p>}
    {s.baseVersionNumber !== p.currentVersion && s.integrationStatus !== "MERGED" && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t("lifecycle.earlierVersion", { version: s.baseVersionNumber, current: p.currentVersion })}<Link className="mt-2 block font-semibold underline" href={routeVersionPath(p.routeId, s.baseVersionNumber)}>{t("lifecycle.proposedOn", { version: s.baseVersionNumber })} →</Link></p>}
    <h3 className="mt-6 font-semibold">{t("comments.title")} ({s.commentCount})</h3>
    <div className="mt-3 space-y-2">{s.comments.map(comment => <div key={comment.publicId} id={`comment-${comment.publicId}`} className="rounded-lg bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><strong className="break-words">{comment.authorName}</strong>{p.isOwner && <Status value={comment.moderationStatus} />}</div>
      <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{comment.content}</p>
      {p.isOwner && comment.moderationStatus === "PENDING" && <div className="mt-2 flex flex-wrap gap-3"><button disabled={busy} onClick={() => void moderateComment(comment, "REJECTED")} className="route-text-action text-xs font-semibold text-red-700">{t("moderation.reject")}</button><button disabled={busy} onClick={() => void moderateComment(comment, "PUBLISHED")} className="route-text-action text-xs font-semibold text-blue-700">{t("moderation.publish")}</button></div>}
    </div>)}</div>
    {s.moderationStatus === "PUBLISHED" && s.integrationStatus !== "MERGED" && <div className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="font-semibold">{t("comments.add")}</h3>
      <label className="mt-3 block text-xs font-medium text-slate-600">{t("comments.name")}<input maxLength={80} value={name} onChange={event => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label>
      <label className="mt-3 block text-xs font-medium text-slate-600">{t("comments.placeholder")}<textarea maxLength={2000} value={content} onChange={event => setContent(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label>
      <button disabled={busy || !name.trim() || !content.trim()} onClick={() => void submit()} className="route-button mt-3 w-full bg-emerald-700 text-white">{t("comments.submit")}</button>
      {sent && <p role="status" className="mt-2 text-sm text-emerald-700">{t("comments.awaiting")}</p>}
    </div>}
  </aside>;
}
function Status({ value }: { value: ModerationStatus }) {
  const { t } = useTranslation();
  return <span className={`text-xs font-medium ${value === "PENDING" ? "text-amber-800" : "text-slate-500"}`}>{t(`moderation.${value.toLowerCase()}`)}</span>;
}
