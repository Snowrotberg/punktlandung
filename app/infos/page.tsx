import type { Metadata } from "next";
import {
  Globe2,
  Megaphone,
  ShieldCheck,
  Waypoints
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { InfoPageShell } from "@/components/InfoPageShell";
import { RedesignButtonLink } from "@/components/redesign";
import { absoluteUrl } from "@/lib/seo";
import { HelpBackLink } from "@/components/HelpBackLink";

export const metadata: Metadata = {
  title: "Über Punktlandung – Spielidee, Inhalte und Web-Version",
  description:
    "Hintergründe zu Punktlandung: Spielidee, redaktionell gepflegte Inhalte, kostenlose Web-Version und Finanzierung des Projekts.",
  alternates: {
    canonical: absoluteUrl("/infos")
  }
};

function IconHeading({ Icon, children }: { Icon: LucideIcon; children: ReactNode }) {
  return <h2 className="flex items-center gap-3 text-[22px] leading-tight text-white"><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />{children}</h2>;
}

export default function InfosPage() {
  return (
    <InfoPageShell
      fillDesktop
      plainContent
      eyebrow="Über das Projekt"
      title="Was ist Punktlandung?"
      intro="Punktlandung ist ein eigenständig entwickeltes Geografie-Spiel für den Browser. Hier erklären wir, was das Projekt anbietet, wie die Inhalte gepflegt werden und wie die Web-Version weiterentwickelt wird."
      titleAction={<HelpBackLink />}
    >
      <p className="mt-3 text-sm text-slate-400">Zuletzt aktualisiert: 30. August 2026</p>

      <div className="mt-6 grid items-stretch gap-4 md:grid-cols-2">
      <section className="punktlandung-info-static-card rounded-xl p-5">
        <IconHeading Icon={Waypoints}>Die Spielidee</IconHeading>
        <p className="mt-3 max-w-4xl leading-7 text-slate-300">
          Statt eine vorgegebene Antwort auszuwählen, setzt du selbst einen Pin auf die Weltkarte. Die Entfernung zum
          tatsächlichen Ziel entscheidet über die Punkte. So wird geografisches Wissen nicht nur als richtig oder
          falsch bewertet, sondern räumlich nachvollziehbar. Punktlandung lässt sich allein oder gemeinsam und ohne
          vorherige Anmeldung ausprobieren.
        </p>
      </section>

      <section className="punktlandung-info-static-card rounded-xl p-5">
        <IconHeading Icon={ShieldCheck}>Wie werden die Inhalte gepflegt?</IconHeading>
        <p className="mt-3 max-w-4xl leading-7 text-slate-300">
          Der aktive Aufgabenkatalog wird im Projekt gepflegt und vor der Veröffentlichung redaktionell sowie technisch
          geprüft. Öffentlich nachvollziehbar bleiben Kategorien, Bestandszahlen, Bildquellen und Lizenzen. Interne
          Auswahl-, Sicherheits- und Missbrauchsprüfungen werden nur in ihren Grundsätzen beschrieben, damit sie nicht
          umgangen werden können.
        </p>
      </section>
        <article className="punktlandung-info-static-card rounded-xl p-5">
          <IconHeading Icon={Globe2}>Web-Version</IconHeading>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Das Spiel ist vollständig im Browser nutzbar und wird laufend weiterentwickelt. Funktionen, Aufgaben
            und Darstellung werden schrittweise verbessert, ohne dass für den Einstieg eine Installation nötig ist.
          </p>
        </article>
        <article className="punktlandung-info-static-card rounded-xl p-5">
          <IconHeading Icon={Megaphone}>Finanzierung und Werbung</IconHeading>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Punktlandung kann kostenlos gespielt werden. Perspektivisch soll Werbung einen Teil der laufenden Kosten
            für Hosting, Karten- und Bildauslieferung decken. Informations-, Hilfe- und Rechtstexte stehen unabhängig
            davon im Vordergrund.
          </p>
        </article>
      </div>

      <section className="mt-8 border-t border-slate-800 pt-6">
        <h2 className="text-[22px] leading-tight text-white">Transparenz und Orientierung</h2>
        <p className="mt-3 max-w-4xl leading-7 text-slate-300">
          Ausführliche Regeln stehen nicht doppelt auf dieser Projektseite, sondern gesammelt unter Hilfe &amp; Infos.
          Verwendete Bild- und Datenquellen bleiben über den öffentlichen Lizenzbereich nachvollziehbar. Betreiber- und
          Kontaktangaben findest du im {" "}
          <Link href="/impressum" className="font-bold text-emerald-300 underline underline-offset-4">Impressum</Link>.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <RedesignButtonLink href="/faq" tone="primary" className="w-fit">Zu Hilfe &amp; Infos</RedesignButtonLink>
          <RedesignButtonLink href="/lizenzen" tone="secondary" className="w-fit">Quellen und Lizenzen</RedesignButtonLink>
        </div>
      </section>
    </InfoPageShell>
  );
}
