"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { uploadRoute } from "./api";
import { managementRouteUrl, publicRoutePath } from "./route-links";
import { managementModalCanContinue } from "./management-modal-state";
import { useTranslation } from "react-i18next";

type CreatedRoute = { publicId: string; managementUrl: string };

export function UploadForm() {
  const router=useRouter(); const [error,setError]=useState<string|null>(null);
  const { t }=useTranslation();
  const [created,setCreated]=useState<CreatedRoute|null>(null); const [copyFailed,setCopyFailed]=useState(false); const [copied,setCopied]=useState(false); const [manualConfirmed,setManualConfirmed]=useState(false);
  const mutation=useMutation({mutationFn:uploadRoute,onSuccess:({publicId,managementToken})=>setCreated({publicId,managementUrl:managementRouteUrl(publicId,managementToken,window.location.origin)}),onError:()=>setError(t("upload.failed"))});
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setError(null);const form=new FormData(event.currentTarget);const file=form.get("file");if(!(file instanceof File)||file.size===0){setError(t("upload.emptyFile"));return;}mutation.mutate(form);}
  async function copyAndContinue(){if(!created)return;try{await navigator.clipboard.writeText(created.managementUrl);setCopied(true);window.setTimeout(()=>router.push(publicRoutePath(created.publicId)),600);}catch{setCopyFailed(true);}}
  function continueAfterManualCopy(){if(created&&managementModalCanContinue(copied,copyFailed,manualConfirmed))router.push(publicRoutePath(created.publicId));}
  return <><form onSubmit={submit} className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm">
    <label className="block"><span className="mb-2 block font-medium">{t("upload.file")}</span><input required name="file" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="block w-full rounded border border-slate-300 p-2" /></label>
    <label className="block"><span className="mb-2 block font-medium">{t("upload.routeName")} <span className="font-normal text-slate-500">{t("common.optional")}</span></span><input name="name" maxLength={200} className="block w-full rounded border border-slate-300 p-2" /></label>
    <label className="block"><span className="mb-2 block font-medium">{t("upload.description")} <span className="font-normal text-slate-500">{t("common.optional")}</span></span><textarea name="description" rows={4} className="block w-full rounded border border-slate-300 p-2" /></label>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={mutation.isPending} className="rounded bg-emerald-700 px-5 py-2.5 font-semibold text-white disabled:opacity-60">{mutation.isPending?t("upload.uploading"):t("upload.submit")}</button>
  </form>{created&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="management-title" className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl sm:p-8">
      <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-amber-100 text-2xl text-amber-800">!</div>
      <h2 id="management-title" className="text-2xl font-bold text-slate-950">{t("ownerLink.title")}</h2>
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-slate-700">
        <p>{t("ownerLink.private")}</p><p className="mt-3 font-semibold">{t("ownerLink.warning")}</p>
      </div>
      <label className="mt-5 block text-sm font-semibold text-slate-800">{t("ownerLink.label")}
        <input readOnly value={created.managementUrl} onFocus={(event)=>event.currentTarget.select()} className="mt-2 block w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-700" />
      </label>
      {!copyFailed?<button type="button" onClick={copyAndContinue} disabled={copied} className="mt-5 w-full rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white disabled:bg-emerald-600">{copied?t("ownerLink.copiedOpening"):t("ownerLink.copyAndContinue")}</button>:
      <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
        <p role="alert" className="text-sm text-red-800">{t("ownerLink.copyFailed")}</p>
        <label className="mt-3 flex items-start gap-2 text-sm font-medium text-slate-800"><input type="checkbox" checked={manualConfirmed} onChange={(event)=>setManualConfirmed(event.target.checked)} className="mt-1" />{t("ownerLink.manualConfirm")}</label>
        <button type="button" onClick={continueAfterManualCopy} disabled={!managementModalCanContinue(copied,copyFailed,manualConfirmed)} className="mt-3 w-full rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{t("ownerLink.continue")}</button>
      </div>}
    </section>
  </div>}</>;
}
