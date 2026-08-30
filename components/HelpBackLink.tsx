import Link from "next/link";

export function HelpBackLink() {
  return (
    <Link href="/faq" className="punktlandung-back-link inline-flex w-fit items-center text-sm font-bold text-emerald-300 no-underline hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300">
      ← Zurück zu Hilfe &amp; Infos
    </Link>
  );
}
