import { UploadForm } from "@/features/routes/upload-form";
export default function Home() {
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
    <h1 className="text-4xl font-bold tracking-tight">Route Community</h1>
    <p className="mt-4 text-lg text-slate-600">Upload a GPX route and share it with people who know the area.</p>
    <UploadForm />
  </main>;
}
