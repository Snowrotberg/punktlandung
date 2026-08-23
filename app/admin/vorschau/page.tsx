import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { FinalResultPreview } from "@/components/FinalResultPreview";
import { SoundProvider } from "@/components/SoundProvider";
import { getAdminAccountContext } from "@/lib/adminAccess.server";

export const metadata: Metadata = {
  title: "Admin-Vorschau",
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";

type AdminPreviewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPreviewPage({ searchParams }: AdminPreviewPageProps) {
  const context = await getAdminAccountContext();
  if (!context) redirect("/konto");

  const params = await searchParams;
  const requestedPage = Array.isArray(params.seite) ? params.seite[0] : params.seite;
  if (requestedPage !== "aufloesung" && requestedPage !== "endergebnis") redirect("/admin");

  const surface = requestedPage === "aufloesung" ? "resolution" : "final";
  return <main className="min-h-dvh bg-slate-950">
    <AppErrorBoundary>
      <SoundProvider>
        <FinalResultPreview playerCount={surface === "resolution" ? 3 : 10} mode="party" surface={surface} />
      </SoundProvider>
    </AppErrorBoundary>
  </main>;
}
