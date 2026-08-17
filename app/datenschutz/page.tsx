import type { Metadata } from "next";
import { InfoPageShell } from "@/components/InfoPageShell";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Datenschutz",
  alternates: { canonical: absoluteUrl("/datenschutz") }
};

const externalLinkClass = "font-bold text-emerald-300 underline-offset-4 hover:text-emerald-200 hover:underline";

export default function DatenschutzPage() {
  return (
    <InfoPageShell
      contentClassName="punktlandung-legal-panel"
      eyebrow="Rechtliches"
      title="Datenschutzerklärung"
      intro="Informationen zur Verarbeitung personenbezogener Daten und zu den Rechten betroffener Personen."
    >
      <p className="text-sm text-slate-400">Stand: 23. Juli 2026</p>
      <p className="mt-4 text-slate-300">
          Diese Datenschutzerklärung erläutert, welche personenbezogenen Daten bei der Nutzung von
          Punktlandung verarbeitet werden und welche Rechte betroffene Personen haben.
        </p>

      <div className="mt-7 space-y-7 text-sm leading-6 text-slate-300">
          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">1. Verantwortlicher</h2>
            <p className="mt-2">
              Tim Kleinheins
              <br />
              Pfauenbergsteige 84
              <br />
              73732 Esslingen
              <br />
              Deutschland
              <br />
              E-Mail:{" "}
              <a href="mailto:aintartstudio@gmail.com" className={externalLinkClass}>
                aintartstudio@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">2. Allgemeine Hinweise und Rechtsgrundlagen</h2>
            <p className="mt-2">
              Personenbezogene Daten sind alle Informationen, die sich auf eine identifizierte oder
              identifizierbare Person beziehen. Punktlandung verarbeitet Daten nur, soweit dies zur
              Bereitstellung des Spiels, zur Erfüllung nutzerseitig angeforderter Funktionen, zur Sicherheit
              des Angebots oder für Werbung nach einer gegebenenfalls erforderlichen Einwilligung notwendig ist.
            </p>
            <p className="mt-2">
              Maßgebliche Rechtsgrundlagen sind insbesondere Art. 6 Abs. 1 Buchst. a DSGVO (Einwilligung),
              Art. 6 Abs. 1 Buchst. b DSGVO (Durchführung des angeforderten Nutzungsverhältnisses) und Art. 6
              Abs. 1 Buchst. f DSGVO (berechtigte Interessen). Für das Speichern von Informationen auf dem
              Endgerät oder den Zugriff darauf gilt zusätzlich § 25 TDDDG.
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">3. Hosting und Serverprotokolle</h2>
            <p className="mt-2">
              Website und Online-Server werden auf einem virtuellen Server der netcup GmbH,
              Emmy-Noether-Straße 10, 76131 Karlsruhe, Deutschland, am Serverstandort Nürnberg betrieben.
              Mit netcup besteht ein Vertrag zur Auftragsverarbeitung gemäß Art. 28 DSGVO.
            </p>
            <p className="mt-2">
              Beim Aufruf des Angebots verarbeiten die Server technisch erforderliche Verbindungsdaten. Dazu
              können insbesondere IP-Adresse, Datum und Uhrzeit, angeforderte Adresse, übertragene Datenmenge,
              Referrer, Browserkennung, Betriebssystem sowie Status- und Fehlerangaben gehören. Die Verarbeitung
              dient der sicheren und stabilen Bereitstellung sowie der Erkennung und Abwehr von Missbrauch. Sie
              erfolgt auf Grundlage von Art. 6 Abs. 1 Buchst. f DSGVO. Das berechtigte Interesse liegt im sicheren
              und störungsfreien Betrieb des Angebots. Serverprotokolle werden spätestens nach 14 Tagen automatisch
              gelöscht, sofern sie nicht ausnahmsweise zur Aufklärung eines konkreten Sicherheitsvorfalls länger
              benötigt werden.
            </p>
            <a
              href="https://www.netcup.com/de/kontakt/datenschutzerklaerung"
              target="_blank"
              rel="noreferrer"
              className={externalLinkClass}
            >
              Datenschutzerklärung von netcup
            </a>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">4. Lokale Browser-Speicherung</h2>
            <p className="mt-2">
              Punktlandung speichert bestimmte Spieldaten und Einstellungen direkt im Browser. Dazu können der
              gewählte Spielername, Soundeinstellung, lokale Spielstände und Sitzungen, zuletzt verwendete Orte,
              selbst erstellte Kartenpakete, die Adresse des Online-Servers, den Zeitpunkt einer späteren
              Feedback-Einladung sowie eine Werbe- oder Einwilligungsentscheidung gehören. Kurzlebige Kennungen und Zustände eines Online-Raums können im
              Sitzungsspeicher des Browsers abgelegt werden.
            </p>
            <p className="mt-2">
              Diese Speicherung ermöglicht die angeforderten Spielfunktionen, das Wiederaufnehmen einer Runde und
              das Beibehalten von Einstellungen. Rechtsgrundlagen sind Art. 6 Abs. 1 Buchst. b und f DSGVO sowie,
              soweit die Speicherung technisch unbedingt erforderlich ist, § 25 Abs. 2 Nr. 2 TDDDG. Eine
              Einwilligungsentscheidung wird auf Grundlage von Art. 6 Abs. 1 Buchst. a DSGVO und § 25 Abs. 1 TDDDG
              gespeichert.
            </p>
            <p className="mt-2">
              Sitzungsspeicher wird grundsätzlich mit dem Ende der Browsersitzung gelöscht. Dauerhafte lokale
              Einträge bleiben erhalten, bis sie durch die Anwendung überschrieben, zurückgesetzt oder über die
              Browser-Einstellungen gelöscht werden. Falls ein passwortgeschützter Testzugang aktiv ist, wird ein
              technisch notwendiges Zugangscookie für bis zu 30 Tage gespeichert.
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">5. Online-Räume und WebSocket-Verbindungen</h2>
            <p className="mt-2">
              Online-Räume funktionieren ohne Benutzerkonto. Für Einrichtung, Beitritt und Ablauf eines Raums
              werden je nach Spielverlauf Raumcode, Spielername, technische Spielerkennung, Rolle oder Team,
              gewählte Einstellungen, Bereitschafts- und Verbindungsstatus, Tipps, Punkte und Rundenergebnisse
              verarbeitet. Diese Daten sind erforderlich, damit die angeforderte Mehrspielerfunktion bereitgestellt
              werden kann. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. b DSGVO.
            </p>
            <p className="mt-2">
              Aktive Raumdaten werden nur im Arbeitsspeicher des Online-Servers gehalten und spätestens drei Stunden
              nach der letzten Aktivität automatisch gelöscht. Es erfolgt keine dauerhafte Speicherung in einer
              Spielerdatenbank. Technische Verbindungs- und Fehlerdaten können zusätzlich in den unter Ziffer 3
              beschriebenen Serverprotokollen enthalten sein.
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">6. Karten von OpenFreeMap</h2>
            <p className="mt-2">
              Für die Kartenansichten werden Vektorkacheln, Schrift- und Grafikressourcen von OpenFreeMap
              (Hyperknot Software Kft., Ungarn) abgerufen. Beim Abruf werden technisch notwendige Verbindungsdaten an
              OpenFreeMap und gegebenenfalls dessen CDN-Dienstleister übermittelt. OpenFreeMap gibt an, reguläre
              Serverprotokolle ohne IP-Adressen zu führen; bei Sicherheitsvorfällen können IP-Adressen vorübergehend
              für höchstens 30 Tage protokolliert werden. Die Einbindung ist für die vom Nutzer aufgerufene Karten-
              und Spielfunktion erforderlich und erfolgt auf Grundlage von Art. 6 Abs. 1 Buchst. b DSGVO.
              Karteninhalte basieren auf Daten der OpenStreetMap-Mitwirkenden und dem OpenMapTiles-Schema.
            </p>
            <a
              href="https://openfreemap.org/privacy/"
              target="_blank"
              rel="noreferrer"
              className={externalLinkClass}
            >
              Datenschutzerklärung von OpenFreeMap
            </a>
            <span className="mx-2 text-slate-600">·</span>
            <a
              href="https://openfreemap.org/tos/"
              target="_blank"
              rel="noreferrer"
              className={externalLinkClass}
            >
              Nutzungsbedingungen von OpenFreeMap
            </a>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">7. Bilder von Wikimedia Commons</h2>
            <p className="mt-2">
              Punktlandung nutzt frei lizenzierte Bilder und zugehörige Metadaten aus Wikimedia Commons. Inhalte
              können über einen eigenen Serverabruf oder unmittelbar von Servern der Wikimedia Foundation, Inc.,
              1 Sansome Street, Suite 1895, San Francisco, California 94104, USA, geladen werden. Bei einem direkten
              Abruf können insbesondere IP-Adresse, Browserkennung, angeforderte Datei und Zeitpunkt an Wikimedia
              übermittelt werden. Die Verarbeitung dient der Bereitstellung der angeforderten Bild- und
              Spielfunktion und erfolgt auf Grundlage von Art. 6 Abs. 1 Buchst. b DSGVO. Bei einer Übermittlung in
              die USA gelten die von Wikimedia beschriebenen Datenschutz- und Übermittlungsbedingungen.
            </p>
            <a
              href="https://foundation.wikimedia.org/wiki/Policy:Privacy_policy/de"
              target="_blank"
              rel="noreferrer"
              className={externalLinkClass}
            >
              Datenschutzrichtlinie der Wikimedia Foundation
            </a>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">8. Google AdSense, Google Analytics und Einwilligungsverwaltung</h2>
            <p className="mt-2">
              Zur Finanzierung des Angebots bindet Punktlandung Google AdSense ein. Die öffentliche Auslieferung
              von Anzeigen beginnt erst nach der Freigabe der Website. Anbieter für Personen im
              Europäischen Wirtschaftsraum ist Google Ireland Limited, Gordon House, Barrow Street, Dublin 4,
              Irland. AdSense und beteiligte Werbepartner können Informationen auf dem Endgerät speichern oder
              auslesen und Daten wie IP-Adresse, Geräte- und Browserinformationen, ungefähren Standort,
              Seitenaufrufe und Interaktionen verarbeiten. Dies dient je nach Auswahl insbesondere der
              Anzeigenbereitstellung und -messung, Personalisierung sowie Betrugs- und Missbrauchsprävention.
            </p>
            <p className="mt-2">
              Soweit hierfür eine Einwilligung erforderlich ist, wird sie über die von Google bereitgestellte
              Consent-Management-Plattform eingeholt. Rechtsgrundlagen sind Art. 6 Abs. 1 Buchst. a DSGVO und § 25
              Abs. 1 TDDDG. Die Einwilligung ist freiwillig und kann jederzeit mit Wirkung für die Zukunft über die
              Datenschutzeinstellungen widerrufen oder geändert werden. Die Auswahl wird gespeichert, damit sie bei
              späteren Aufrufen berücksichtigt werden kann. Empfänger können Google, mit Google verbundene
              Unternehmen und die in der Einwilligungsabfrage genannten Werbepartner sein. Dabei sind auch
              Übermittlungen in Drittländer, insbesondere die USA, möglich. Einzelheiten zu Empfängern,
              Speicherfristen und Übermittlungsgrundlagen stellt Google in der Einwilligungsabfrage und seinen
              Datenschutzinformationen bereit.
            </p>
            <div className="mt-2 flex flex-col items-start gap-2">
              <a
                href="https://policies.google.com/privacy?hl=de"
                target="_blank"
                rel="noreferrer"
                className={externalLinkClass}
              >
                Datenschutzerklärung von Google
              </a>
              <a
                href="https://policies.google.com/technologies/ads?hl=de"
                target="_blank"
                rel="noreferrer"
                className={externalLinkClass}
              >
                Informationen zur Werbung bei Google
              </a>
            </div>
            <p className="mt-2">
              Punktlandung verwendet außerdem Google Analytics 4, um die Nutzung des Angebots auszuwerten. Dabei
              können insbesondere Seitenaufrufe, Sitzungs- und Geräteinformationen sowie grobe Ereignisse wie der
              Start oder vollständige Abschluss einer Partie, Spieltyp, Kategorie und geplante Rundenzahl
              verarbeitet werden. An Analytics werden keine Spielernamen, Raumcodes, E-Mail-Adressen,
              Feedbacktexte, einzelnen Tipps oder Kartenkoordinaten übermittelt.
            </p>
            <p className="mt-2">
              Google Analytics ist mit dem Einwilligungsmodus der Google-Consent-Management-Plattform verbunden.
              In einwilligungspflichtigen Regionen wird die Speicherung von Analytics-Kennungen über die Auswahl
              im Datenschutzdialog gesteuert. Bei verweigerter Einwilligung können technisch reduzierte,
              cookielose Messsignale ohne Speicherung einer Analytics-Kennung auf dem Endgerät übermittelt werden.
              Rechtsgrundlage für einwilligungsabhängige Speicherung und weitergehende Auswertung sind Art. 6 Abs. 1
              Buchst. a DSGVO und § 25 Abs. 1 TDDDG. Die technisch reduzierte Reichweitenmessung dient dem
              berechtigten Interesse, Betrieb, Nutzung und Fehler des Web-Angebots beurteilen zu können (Art. 6
              Abs. 1 Buchst. f DSGVO). Die Auswahl kann jederzeit über „Cookies“ geändert werden.
            </p>
            <p className="mt-2">
              Die Aufbewahrung von Nutzer- und Ereignisdaten ist in Google Analytics auf zwei Monate eingestellt.
              Diese Frist betrifft die von Google bereitgestellten Daten auf Nutzer- und Ereignisebene; aggregierte
              Standardberichte können nach den Vorgaben von Google länger verfügbar bleiben.
            </p>
            <a
              href="https://support.google.com/analytics/answer/7667196?hl=de"
              target="_blank"
              rel="noreferrer"
              className={externalLinkClass}
            >
              Informationen zur Datenaufbewahrung bei Google Analytics
            </a>
            <p className="mt-2">
              Zusätzlich speichert Punktlandung auf dem eigenen Server ausschließlich anonyme Betriebszähler,
              etwa Seitenaufrufe und Besuche sowie die Anzahl gestarteter und beendeter Partien, Räume und
              Verbindungen und Spitzenwerte der gleichzeitigen Auslastung. Diese Zähler enthalten keine
              Nutzerkennungen, Namen, IP-Adressen,
              Raumcodes oder Spielkoordinaten und werden nur für interne Wochenberichte verwendet.
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">9. Feedback und E-Mail-Kontakt</h2>
            <p className="mt-2">
              Bei einer Kontaktaufnahme per E-Mail werden die übermittelten Angaben verarbeitet, um die Anfrage zu
              beantworten. Rechtsgrundlage ist je nach Inhalt Art. 6 Abs. 1 Buchst. b oder f DSGVO. Das berechtigte
              Interesse liegt in der Bearbeitung der Anfrage. Die Daten werden gelöscht, sobald die Anfrage
              abschließend geklärt ist und keine gesetzlichen Aufbewahrungspflichten entgegenstehen, spätestens
              jedoch nach 180 Tagen.
            </p>
            <p className="mt-2">
              Über das Feedbackformular kann freiwillig eine Nachricht übermittelt
              werden. Eine E-Mail-Adresse kann optional angegeben werden und wird ausschließlich verwendet, um bei
              Rückfragen auf das Feedback zu antworten. Nach einer beendeten Partie können zusätzlich Spielmodus,
              gewählte Kategorie und Anzahl der gespielten Runden übermittelt werden. Spielernamen, Raumcodes,
              einzelne Tipps und Rundenergebnisse werden nicht mit dem Feedback versendet.
            </p>
            <p className="mt-2">
              Die Verarbeitung dient der Auswertung von Fehlerhinweisen und Verbesserungsvorschlägen sowie der
              Weiterentwicklung von Punktlandung. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO. Das berechtigte
              Interesse liegt in der Qualitätssicherung und Verbesserung des Angebots. Soweit sich eine Nachricht
              auf ein angefordertes oder bestehendes Nutzungsverhältnis bezieht, kann zusätzlich Art. 6 Abs. 1
              Buchst. b DSGVO einschlägig sein.
            </p>
            <p className="mt-2">
              Der Versand erfolgt an das Gmail-Postfach aintartstudio@gmail.com. Anbieter ist Google Ireland
              Limited, Gordon House, Barrow Street, Dublin 4, Irland. Google verarbeitet die E-Mail-Inhalte und
              technischen Versanddaten zur Bereitstellung des Postfachs. Dabei können Daten auch in Drittländer,
              insbesondere die USA, übermittelt werden. Feedbacknachrichten werden spätestens nach 180 Tagen aus
              dem Postfach gelöscht, sofern sie nicht ausnahmsweise zur Klärung eines konkreten Vorgangs länger
              benötigt werden.
            </p>
            <p className="mt-2">
              Die Feedbacknachricht ist für den Versand erforderlich. Die Angabe einer E-Mail-Adresse ist
              freiwillig. Ohne E-Mail-Adresse kann das Feedback ausgewertet, aber keine individuelle Rückfrage
              gestellt oder beantwortet werden. Bitte übermittle über das Formular keine vertraulichen
              Informationen oder besonderen Kategorien personenbezogener Daten.
            </p>
            <p className="mt-2">
              Zum Schutz vor automatisiertem Missbrauch prüft das Formular unter anderem Ausfüllzeit, versteckte
              Formularfelder, Herkunft der Anfrage und Anzahl der Übermittlungen. Eine aus der IP-Adresse abgeleitete
              technische Kennung wird ausschließlich im Arbeitsspeicher des Servers zur Begrenzung wiederholter
              Anfragen gehalten und eine Stunde nach der jeweils letzten Anfrage gelöscht. Ergänzend können die unter Ziffer 3 beschriebenen
              Serverprotokolle entstehen.
            </p>
            <a href="https://policies.google.com/privacy?hl=de" target="_blank" rel="noreferrer" className={externalLinkClass}>
              Datenschutzerklärung von Google
            </a>
            <br />
            <a href="https://policies.google.com/privacy/frameworks?hl=de" target="_blank" rel="noreferrer" className={externalLinkClass}>
              Google: Rechtliche Grundlagen für internationale Datenübermittlungen
            </a>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">10. Pflichtangaben und automatisierte Entscheidungen</h2>
            <p className="mt-2">
              Pflichtangaben werden jeweils direkt an der betreffenden Funktion gekennzeichnet. Ohne die für eine
              Spielfunktion erforderlichen Angaben, etwa einen Spielernamen für einen Online-Raum, kann diese
              Funktion nicht bereitgestellt werden. Punktlandung trifft keine ausschließlich automatisierten
              Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung und erstellt kein Profiling im Sinne
              von Art. 22 DSGVO. Die automatische Punkteberechnung dient ausschließlich dem Spielablauf.
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">11. Verschlüsselung</h2>
            <p className="mt-2">
              Die Website wird verschlüsselt über HTTPS übertragen. Dadurch sind übermittelte Daten während des
              Transports grundsätzlich vor dem Mitlesen durch Dritte geschützt.
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">12. Rechte betroffener Personen</h2>
            <p className="mt-2">
              Betroffene Personen haben im Rahmen der gesetzlichen Voraussetzungen das Recht auf Auskunft (Art. 15
              DSGVO), Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18
              DSGVO), Datenübertragbarkeit (Art. 20 DSGVO) und Widerspruch gegen Verarbeitungen auf Grundlage
              berechtigter Interessen (Art. 21 DSGVO). Eine erteilte Einwilligung kann jederzeit mit Wirkung für die
              Zukunft widerrufen werden. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt
              unberührt. Zur Ausübung dieser Rechte genügt eine Nachricht an die unter Ziffer 1 genannte Adresse.
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">13. Beschwerderecht</h2>
            <p className="mt-2">
              Betroffene Personen haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.
              Zuständig für den Verantwortlichen ist insbesondere:
            </p>
            <p className="mt-2">
              Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg
              <br />
              Heilbronner Straße 35
              <br />
              70191 Stuttgart
              <br />
              E-Mail: poststelle@lfdi.bwl.de
            </p>
            <a
              href="https://www.baden-wuerttemberg.datenschutz.de/kontakt-aufnehmen/"
              target="_blank"
              rel="noreferrer"
              className={externalLinkClass}
            >
              Kontakt zur Datenschutzaufsicht
            </a>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">14. Änderungen dieser Datenschutzerklärung</h2>
            <p className="mt-2">
              Diese Datenschutzerklärung wird angepasst, wenn sich Funktionen, eingesetzte Dienste oder rechtliche
              Anforderungen ändern. Es gilt die jeweils auf dieser Seite veröffentlichte Fassung.
            </p>
          </section>
      </div>
    </InfoPageShell>
  );
}
