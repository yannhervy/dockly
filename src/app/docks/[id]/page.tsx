import DockDetailClient from "./DockDetailClient";

// Required for Next.js static export — dock IDs are dynamic, resolved client-side
export function generateStaticParams() {
  return [];
}

export default function DockDetailPage() {
  return <DockDetailClient />;
}
