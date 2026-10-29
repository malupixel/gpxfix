import { RouteEditor } from "@/features/route-editor/route-editor";
import { GhostRoutesProvider } from "@/features/ghost-routes/provider";
export default function DrawRoutePage(){return <GhostRoutesProvider><RouteEditor/></GhostRoutesProvider>}
