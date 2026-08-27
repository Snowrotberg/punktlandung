import licenseCatalog from "@/data/generated/image-licenses.generated.json";
import { builtInLocations } from "@/data/locations";
import { imageFileNameForLicense, imageLicenseEntryId, normalizeImageLicenseFileName } from "@/lib/imageLicenseLink";

type LicenseEntry = {
  fileName: string;
  artist: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
};

const activeImageFiles = new Set(
  builtInLocations
    .map(imageFileNameForLicense)
    .filter((fileName): fileName is string => Boolean(fileName))
    .map(normalizeImageLicenseFileName)
);
const entries = (licenseCatalog.entries as LicenseEntry[]).filter((entry) =>
  activeImageFiles.has(normalizeImageLicenseFileName(entry.fileName))
);

function groupLabel(fileName: string) {
  const firstCharacter = fileName.trim().charAt(0).toLocaleUpperCase("de");
  return /[A-ZÄÖÜ]/.test(firstCharacter) ? firstCharacter : "0–9";
}

const groupedEntries = entries.reduce<Map<string, LicenseEntry[]>>((groups, entry) => {
  const label = groupLabel(entry.fileName);
  const group = groups.get(label) ?? [];
  group.push(entry);
  groups.set(label, group);
  return groups;
}, new Map());

export function ImageLicenseCatalog({ selectedFile, selectedGroup }: { selectedFile?: string; selectedGroup?: string }) {
  const normalizedSelectedFile = selectedFile ? normalizeImageLicenseFileName(selectedFile) : null;
  const selectedEntryAvailable = normalizedSelectedFile !== null && entries.some((entry) =>
    normalizeImageLicenseFileName(entry.fileName) === normalizedSelectedFile
  );
  const selectedFileGroup = selectedEntryAvailable && selectedFile ? groupLabel(selectedFile) : null;
  const activeGroup = selectedFileGroup ?? (selectedGroup && groupedEntries.has(selectedGroup) ? selectedGroup : null);
  const visibleEntries = activeGroup ? groupedEntries.get(activeGroup) ?? [] : [];
  return (
    <section id="bildnachweise">
      <h2 className="text-[22px] font-black leading-tight text-white">Einzelnachweise der Ratebilder</h2>
      <p className="mt-2">
        Der Katalog enthält {entries.length.toLocaleString("de-DE")} derzeit im Spiel verwendete Wikimedia-Dateien. Öffne einen
        Buchstaben und anschließend eine Datei, um Urheber, Lizenz und Originalseite aufzurufen.
      </p>

      {selectedFile && !selectedEntryAvailable && (
        <p
          id={imageLicenseEntryId(selectedFile)}
          data-highlighted="true"
          className="punktlandung-license-entry mt-4 rounded border border-slate-800 bg-slate-950/60 px-3 py-2"
        >
          Für <strong>{selectedFile}</strong> ist im aktuellen Katalog noch kein Einzelnachweis hinterlegt.
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
                const selected = normalizeImageLicenseFileName(entry.fileName) === normalizedSelectedFile;
                return <details key={`${entry.fileName}-${entry.sourceUrl}-${entryIndex}`} id={imageLicenseEntryId(entry.fileName)} open={selected} data-highlighted={selected ? "true" : undefined} className="punktlandung-license-entry rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
                  <summary className="cursor-pointer break-words font-bold text-slate-200 marker:text-emerald-300">
                    {entry.fileName} <span className="text-xs font-semibold text-emerald-300">· {entry.license}</span>
                  </summary>
                  <div className="mt-2 space-y-2 border-t border-slate-800 pt-2 text-xs leading-5 text-slate-400">
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
                  </div>
                </details>;
              })}
        </div>
      </div>}
    </section>
  );
}
