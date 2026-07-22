import type { Metadata } from "next";
import { InfoPageShell } from "@/components/InfoPageShell";

export const metadata: Metadata = {
  title: "Impressum",
};

const externalLinkClass = "font-bold text-emerald-300 underline-offset-4 hover:text-emerald-200 hover:underline";

export default function ImpressumPage() {
  return (
    <InfoPageShell fillDesktop eyebrow="Rechtliches" title="Impressum" intro="Anbieterkennzeichnung und Kontaktangaben zu Punktlandung.">
      <div className="space-y-6 text-sm leading-6 text-slate-300">
          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Angaben gemäß § 5 DDG</h2>
            <p className="mt-2">
              Punktlandung
              <br />
              Tim Kleinheins, Einzelunternehmer
              <br />
              Pfauenbergsteige 84
              <br />
              73732 Esslingen
              <br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Kontakt</h2>
            <p className="mt-2">
              E-Mail:{" "}
              <a href="mailto:aintartstudio@gmail.com" className={externalLinkClass}>
                aintartstudio@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Umsatzsteuer-ID</h2>
            <p className="mt-2">
              Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:
              <br />
              DE314498696
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Verantwortlich für den Inhalt</h2>
            <p className="mt-2">
              Verantwortlich für journalistisch-redaktionelle Inhalte gemäß § 18 Abs. 2 MStV:
              <br />
              Tim Kleinheins
              <br />
              Pfauenbergsteige 84
              <br />
              73732 Esslingen
              <br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Verbraucherstreitbeilegung</h2>
            <p className="mt-2">
              Ich bin nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>
      </div>
    </InfoPageShell>
  );
}
