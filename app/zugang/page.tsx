import { permanentRedirect } from "next/navigation";
import { safeAuthReturnPath } from "@/lib/authNavigation";

export default async function LegacyAccessPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeAuthReturnPath(params.next);
  const query = new URLSearchParams({ returnTo });

  permanentRedirect(`/anmelden?${query.toString()}`);
}
