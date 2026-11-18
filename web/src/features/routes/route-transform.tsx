"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { apiClient, ApiError } from "@/lib/api-client";
import { apiErrorKey } from "@/i18n/api-errors";
import type { RouteData } from "@/types/route";
import { EditorMap } from "@/features/route-editor/editor-map";
import { documentFromGeometry } from "@/features/route-editor/model";
import { createRouteMeasure, findNearestPositionOnRoute, type RouteCoordinate, type RoutePosition } from "./route-geometry";
import { publicRoutePath } from "./route-links";

export type GeometryOperation = "REVERSE" | "RELOCATE";
type Preview = { coordinates: RouteCoordinate[]; closure: RouteCoordinate[]; addedDistanceMeters: number; distanceMeters: number; elevationGainMeters: number | null; elevationLossMeters: number | null; previewHash: string };
type Options = { automaticLoop: boolean; declaredLoop: boolean; gapMeters: number; thresholdMeters: number };
export function RouteTransform({ route, operation, onClose }: { route: RouteData; operation: GeometryOperation; onClose: () => void }) {
  const { t }=useTranslation(); const router=useRouter();
  const [options,setOptions]=useState<Options|null>(null),[position,setPosition]=useState<RoutePosition|null>(null);
  const [declareLoop,setDeclareLoop]=useState(false),[reverse,setReverse]=useState(false),[directClosure,setDirectClosure]=useState(false);
  const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null);
  const panel=useRef<HTMLElement>(null), callbacks=useRef({onClose,saving});
  useEffect(()=>{callbacks.current={onClose,saving};},[onClose,saving]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";panel.current?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&!callbacks.current.saving){event.preventDefault();callbacks.current.onClose();}
      if(event.key!=="Tab")return;
      const controls=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),canvas,[tabindex="0"]')??[]).filter(node=>node.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){event.preventDefault();first?.focus();}
    };
    document.addEventListener("keydown",key,true);
    return()=>{document.removeEventListener("keydown",key,true);document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  const request=useRef(0);
  const base=`/api/routes/${encodeURIComponent(route.publicId)}/owner/geometry`;
  useEffect(()=>{let active=true;apiClient<Options>(`${base}/options`,{cache:"no-store"}).then(value=>{if(active)setOptions(value);}).catch(caught=>{if(active)setError(apiErrorKey(caught));});return()=>{active=false;};},[base]);
  const measure=useMemo(()=>createRouteMeasure(route.geometry.coordinates),[route.geometry.coordinates]);
  const editorDocument=useMemo(()=>documentFromGeometry(preview?.coordinates??route.geometry.coordinates),[preview,route.geometry.coordinates]);
  const body={baseVersionNumber:route.viewedVersion,operation,segmentIndex:position?.segmentIndex,segmentFraction:position?.segmentFraction,declareLoop,reverse,directClosure};
  function invalidate(){request.current++;setPreview(null);setError(null);setBusy(false);}
  function pick(coordinate:RouteCoordinate){if(operation!=="RELOCATE"||saving)return;invalidate();setPosition(findNearestPositionOnRoute(coordinate,measure));}
  async function showPreview(){const version=++request.current;setBusy(true);setError(null);setPreview(null);try{const value=await apiClient<Preview>(`${base}/preview`,{method:"POST",body:JSON.stringify(body)});if(version===request.current)setPreview(value);}catch(caught){if(version===request.current)setError(caught instanceof ApiError&&[422,502].includes(caught.status)?"geometryActions.closureError":apiErrorKey(caught));}finally{if(version===request.current)setBusy(false);}}
  async function save(){if(!preview||saving)return;setSaving(true);setError(null);try{await apiClient(`${base}/versions`,{method:"POST",body:JSON.stringify({...body,previewHash:preview.previewHash})});router.push(publicRoutePath(route.publicId,route.branchId));router.refresh();onClose();}catch(caught){setError(apiErrorKey(caught));setSaving(false);setPreview(null);}}
  const eligible=operation==="REVERSE"||Boolean(position&&options&&(options.automaticLoop||options.declaredLoop||declareLoop));
  return createPortal(<section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t(operation==="REVERSE"?"geometryActions.reverse":"geometryActions.relocate")} className="fixed inset-0 z-50 bg-slate-100">
    <EditorMap document={editorDocument} readOnly onPick={pick} closure={preview?.closure} selectedSegmentId={null} selectedPointId={null} inserting={false} onMapClick={()=>{}} onInsert={()=>{}} onMove={()=>{}} onSelectSegment={()=>{}} onSelectPoint={()=>{}} />
    <div className="absolute left-3 right-16 top-3 z-20 rounded-lg bg-white p-3 shadow sm:w-fit"><h2 className="font-bold">{t(operation==="REVERSE"?"geometryActions.reverse":"geometryActions.relocate")}</h2><p className="text-sm">{t(operation==="REVERSE"?"geometryActions.reverseHelp":"geometryActions.pickHelp")}</p></div>
    <div className="absolute bottom-3 left-1/2 z-20 max-h-[48dvh] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-auto rounded-xl bg-white p-4 shadow-xl">
      {operation==="RELOCATE"&&<div className="space-y-2 text-sm">
        {options&&<p>{t(options.automaticLoop?"geometryActions.autoLoop":"geometryActions.openRoute",{gap:Math.round(options.gapMeters),threshold:options.thresholdMeters})}</p>}
        {options&&!options.automaticLoop&&!options.declaredLoop&&<label className="flex gap-2"><input type="checkbox" disabled={saving} checked={declareLoop} onChange={e=>{invalidate();setDeclareLoop(e.target.checked);}} />{t("geometryActions.declareLoop")}</label>}
        <label className="flex gap-2"><input type="checkbox" disabled={saving} checked={reverse} onChange={e=>{invalidate();setReverse(e.target.checked);}} />{t("geometryActions.reverse")}</label>
        {Boolean(options?.gapMeters)&&<label className="flex gap-2"><input type="checkbox" disabled={saving} checked={directClosure} onChange={e=>{invalidate();setDirectClosure(e.target.checked);}} />{t("geometryActions.directClosure")}</label>}
        {position&&<p role="status">{t("geometryActions.selected",{distance:(position.distanceMeters/1000).toFixed(2)})}</p>}
      </div>}
      {preview&&<div role="status" className="my-3 text-sm"><p>{t("geometryActions.previewStats",{distance:(preview.distanceMeters/1000).toFixed(2),gain:preview.elevationGainMeters===null?"—":Math.round(preview.elevationGainMeters),loss:preview.elevationLossMeters===null?"—":Math.round(preview.elevationLossMeters)})}</p>{preview.closure.length>0&&<p className="font-semibold text-orange-700">{t("geometryActions.closureLength",{distance:Math.round(preview.addedDistanceMeters)})}</p>}<p>{t("geometryActions.confirmHelp")}</p></div>}
      {error&&<p role="alert" className="my-2 text-sm text-red-700">{t(error)}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2"><button disabled={saving} onClick={onClose} className="route-button">{t("common.cancel")}</button><button disabled={!eligible||busy||saving} onClick={()=>void showPreview()} className="route-button">{t(busy?"geometryActions.loading":"geometryActions.preview")}</button><button disabled={!preview||busy||saving} onClick={()=>void save()} className="route-button bg-emerald-700 text-white">{t(saving?"editor.saving":"geometryActions.save")}</button></div>
    </div>
  </section>,window.document.body);
}
