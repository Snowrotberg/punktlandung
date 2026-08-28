import licenseCatalog from "@/data/generated/image-licenses.generated.json";
import {
  imageCommonsSourceHref,
  imageLicenseCatalogFileName,
  imageLicenseEntryId,
  imageLicenseEntryMatchesFile,
  normalizeImageLicenseFileName
} from "@/lib/imageLicenseLink";

type LicenseEntry = {
  fileName: string;
  catalogFileName?: string;
  catalogFileNames?: string[];
  availability?: "available" | "unavailable";
  unavailableReason?: string;
  artist: string | null;
  license: string | null;
  licenseUrl: string | null;
  sourceUrl: string;
};

const entries = licenseCatalog.entries as LicenseEntry[];

function groupLabel(fileName: string) {
  const firstCharacter = fileName.trim().charAt(0).toLocaleUpperCase("de");
  return /[A-ZÄÖÜ]/.test(firstCharacter) ? firstCharacter : "0–9";
}

const groupedEntries = entries.reduce<Map<string, LicenseEntry[]>>((groups, entry) => {
  const label = groupLabel(imageLicenseCatalogFileName(entry));
  const group = groups.get(label) ?? [];
  group.push(entry);
  groups.set(label, group);
  return groups;
}, new Map());

export function ImageLicenseCatalog({ selectedFile, selectedGroup }: { selectedFile?: string; selectedGroup?: string }) {
  const normalizedSelectedFile = selectedFile ? normalizeImageLicenseFileName(selectedFile) : null;
  const selectedEntryAvailable = normalizedSelectedFile !== null && entries.some((entry) =>
    imageLicenseEntryMatchesFile(entry, selectedFile ?? "")
  );
  const selectedFileGroup = selectedEntryAvailable && selectedFile ? groupLabel(selectedFile) : null;
  const activeGroup = selectedFileGroup ?? (selectedGroup && groupedEntries.has(selectedGroup) ? selectedGroup : null);
  const visibleEntries = activeGroup ? groupedEntries.get(activeGroup) ?? [] : [];
  return (
    <section id="bildnachweise">
      <h2 className="text-[22px] font-black leading-tight text-white">Einzelnachweise der Ratebilder</h2>
      <p className="mt-2">
        Der Katalog dokumentiert {entries.length.toLocaleString("de-DE")} aktive und früher ausgespielte Wikimedia-Dateien. Öffne
        einen Buchstaben und anschließend eine Datei, um Urheber, Lizenz und Originalseite beziehungsweise dokumentierte
        Verfügbarkeitsangaben aufzurufen.
      </p>

      {selectedFile && !selectedEntryAvailable && (
        <p
          id={imageLicenseEntryId(selectedFile)}
          data-highlighted="true"
          className="punktlandung-license-entry mt-4 rounded border border-slate-800 bg-slate-950/60 px-3 py-2"
        >
          Für <strong>{selectedFile}</strong> ist im lokalen Katalog noch kein vollständiger Einzelnachweis hinterlegt. Die
          Originaldatei und ihre Lizenzangaben können direkt bei Wikimedia Commons geöffnet werden:{" "}
          <a
            href={imageCommonsSourceHref(selectedFile)}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-emerald-300 hover:text-emerald-200"
          >
            Bildquelle öffnen
          </a>
          .
        </p>
      )}

      <nav aria-label="Bildnachweise nach Anfangsbuchstabe" className="mt-4 flex flex-wrap gap-2">
        {[...groupedEntries.entries()].map(([label, group]) => <a
          key={label}
          href={`/lizenzen?gruppe=${encodeURIComponent(label)}#bildnachweise`}
          aria-current={activeGroup === label ? "page" : undefined}
          className={`rounded border px-3 py-2 text-sm font-black ${activeGroup === label ? "border-emerald-300 bg-emerald-300/10 text-emerald-200" : "border-slate-700 bg-slate-950/45 text-slate-300 hover:border-slate-500 hover:text-white"}`}
        >
          {label} <span className="text-xs text-slate-400">({group.length})</span>
        </a>)}
      </nav>

      {!activeGroup && <p className="mt-4 rounded border border-slate-800 bg-slate-950/45 px-4 py-3 text-slate-400">Wähle einen Anfangsbuchstaben, um die zugehörigen Einzelnachweise zu öffnen.</p>}

      {activeGroup && <div className="mt-4 space-y-2">
        <h3 className="text-lg font-black text-white">Einträge {activeGroup} <span className="text-sm text-slate-400">({visibleEntries.length})</span></h3>
        <div className="space-y-2">
              {visibleEntries.map((entry, entryIndex) => {
                const displayFileName = imageLicenseCatalogFileName(entry);
                const selected = normalizedSelectedFile !== null && imageLicenseEntryMatchesFile(entry, selectedFile ?? "");
                const entryIdFileName = selected && selectedFile ? selectedFile : displayFileName;
                return <details key={`${displayFileName}-${entry.sourceUrl}-${entryIndex}`} id={imageLicenseEntryId(entryIdFileName)} open={selected} data-highlighted={selected ? "true" : undefined} className="punktlandung-license-entry rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
                  <summary className="cursor-pointer break-words font-bold text-slate-200 marker:text-emerald-300">
                    {displayFileName} <span className="text-xs font-semibold text-emerald-300">· {entry.availability === "unavailable" ? "nicht mehr bei Commons verfügbar" : entry.license}</span>
                  </summary>
                  {entry.availability === "unavailable" ? <div className="mt-2 space-y-2 border-t border-slate-800 pt-2 text-xs leading-5 text-slate-400">
                    <p>{entry.unavailableReason}</p>
                    <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="inline-block font-bold text-emerald-300 hover:text-emerald-200">
                      Commons-Löschprotokoll öffnen
                    </a>
                  </div> : <div className="mt-2 space-y-2 border-t border-slate-800 pt-2 text-xs leading-5 text-slate-400">
                    <p className="break-words">
                      <span className="font-black text-slate-300">Urheber/Quelle:</span> {entry.artist}
                    </p>
                    <p>
                      <span className="font-black text-slate-300">Lizenz:</span>{" "}
                      {entry.licenseUrl ? (
                        <a
                          href={entry.licenseUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-emerald-300 hover:text-emerald-200"
                        >
                          {entry.license}
                        </a>
                      ) : (
                        entry.license
                      )}
                    </p>
                    <a
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block font-bold text-emerald-300 hover:text-emerald-200"
                    >
                      Originaldatei und vollständige Angaben bei Wikimedia Commons
                    </a>
                  </div>}
                </details>;
              })}
        </div>
      </div>}
    </section>
  );
}
