import { GhostRoutesProvider } from "@/features/ghost-routes/provider";
export default async function RouteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <GhostRoutesProvider key={publicId}>{children}</GhostRoutesProvider>;
}
