"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { uploadRoute } from "./api";
export function UploadForm() {
  const router=useRouter(); const [error,setError]=useState<string|null>(null);
  const mutation=useMutation({mutationFn:uploadRoute,onSuccess:({publicId})=>router.push(`/route/${publicId}`),onError:(value)=>setError(value instanceof Error?value.message:"Upload failed")});
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setError(null);const form=new FormData(event.currentTarget);const file=form.get("file");if(!(file instanceof File)||file.size===0){setError("Choose a non-empty GPX file.");return;}mutation.mutate(form);}
  return <form onSubmit={submit} className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm">
    <label className="block"><span className="mb-2 block font-medium">GPX file</span><input required name="file" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="block w-full rounded border border-slate-300 p-2" /></label>
    <label className="block"><span className="mb-2 block font-medium">Route name <span className="font-normal text-slate-500">(optional)</span></span><input name="name" maxLength={200} className="block w-full rounded border border-slate-300 p-2" /></label>
    <label className="block"><span className="mb-2 block font-medium">Description <span className="font-normal text-slate-500">(optional)</span></span><textarea name="description" rows={4} className="block w-full rounded border border-slate-300 p-2" /></label>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={mutation.isPending} className="rounded bg-emerald-700 px-5 py-2.5 font-semibold text-white disabled:opacity-60">{mutation.isPending?"Uploading…":"Upload route"}</button>
  </form>;
}
