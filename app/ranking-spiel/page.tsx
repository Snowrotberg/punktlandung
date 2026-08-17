import { permanentRedirect } from "next/navigation";

export default function RankedGamePage() {
  permanentRedirect("/solo-modus?rounds=15&time=60");
}
