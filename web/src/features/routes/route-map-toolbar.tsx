export function RouteMapToolbar() {
  return <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 p-1 sm:flex-row sm:items-center sm:justify-between">
    <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold sm:flex">
      <button className="rounded-md bg-white px-5 py-2 text-slate-950 shadow-sm">View route</button>
      <button disabled title="Route suggestions are coming soon" className="rounded-md px-5 py-2 text-slate-600 disabled:cursor-not-allowed">Suggest changes</button>
    </div>
    <div className="grid grid-cols-3 gap-2 text-xs font-semibold sm:flex sm:text-sm">
      <PlaceholderAction icon="●" label="Add note" tone="blue" />
      <PlaceholderAction icon="△" label="Flag section" tone="red" />
      <PlaceholderAction icon="✎" label="Edit route" tone="green" />
    </div>
  </div>;
}

function PlaceholderAction({ icon, label, tone }: { icon: string; label: string; tone: "blue" | "red" | "green" }) {
  const tones = { blue: "text-blue-700", red: "text-red-600", green: "text-emerald-700" };
  return <button disabled title={`${label} is coming soon`} className="route-button min-h-10 bg-white disabled:cursor-not-allowed disabled:opacity-75"><span className={tones[tone]}>{icon}</span> {label}</button>;
}

export function CommunityMarkerLegend() {
  return <div className="sr-only" aria-label="Future community marker styles">
    <span className="community-marker community-marker-issue">Issue</span>
    <span className="community-marker community-marker-detour">Detour</span>
    <span className="community-marker community-marker-note">Note</span>
    <span className="community-marker community-marker-positive">Positive</span>
  </div>;
}
