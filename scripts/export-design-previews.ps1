param(
  [string]$Source = "test-artifacts/design-comparison/design-preview.html",
  [string]$Destination = "test-artifacts/design-preview-backup-2026-08-02/all-pages-all-viewports"
)

$ErrorActionPreference = "Stop"

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$destinationPath = Join-Path (Get-Location) $Destination
New-Item -ItemType Directory -Force -Path $destinationPath | Out-Null

$sourceHtml = Get-Content -Raw -Encoding UTF8 -LiteralPath $sourcePath

$pages = [ordered]@{
  home = "Startseite"
  setup = "Spieleinstellungen"
  lobby = "Warteraum"
  game = "Spiel"
  result = "Aufloesung"
  revisit = "Bild nochmal ansehen"
  final = "Endergebnis"
  info = "Infos"
  feedback = "Feedback"
  imprint = "Impressum"
  privacy = "Datenschutz"
  licenses = "Lizenzen"
  cookies = "Cookie-Einstellungen"
  faq = "FAQ"
  how = "So funktioniert Punktlandung"
  catalog = "Orte und Aufgaben"
  geoguessr = "GeoGuessr-Alternative"
  geography = "Geografie-Spiel"
  places = "Orte erraten"
  "party-content" = "Geografie-Partyspiel"
  "free-game" = "Kostenloses GeoGuessing-Spiel"
}

$viewports = [ordered]@{
  "phone-small" = @{ label = "Phone Small"; width = 360; height = 800 }
  "phone-large" = @{ label = "Phone Large"; width = 430; height = 932 }
  "phone-landscape" = @{ label = "Phone Landscape"; width = 932; height = 430 }
  laptop = @{ label = "Laptop"; width = 1366; height = 768 }
  monitor = @{ label = "Monitor"; width = 1920; height = 1080 }
  "tv-4k" = @{ label = "TV 4K"; width = 3840; height = 2160 }
}

$manifestEntries = @()

foreach ($page in $pages.GetEnumerator()) {
  foreach ($viewport in $viewports.GetEnumerator()) {
    $variant = $sourceHtml
    $variant = $variant -replace '(<option value="(?:phone-small|phone-large|phone-landscape|laptop|monitor|tv-4k)") selected', '$1'
    $variant = $variant.Replace("<option value=`"$($viewport.Key)`">", "<option value=`"$($viewport.Key)`" selected>")
    $variant = $variant.Replace("root.dataset.currentScreen = 'home';", "root.dataset.currentScreen = '$($page.Key)';")
    $variant = $variant.Replace("<option value=`"$($page.Key)`">", "<option value=`"$($page.Key)`" selected>")

    $fileName = "$($page.Key)--$($viewport.Key).html"
    $filePath = Join-Path $destinationPath $fileName
    Set-Content -LiteralPath $filePath -Value $variant -Encoding UTF8

    $manifestEntries += [ordered]@{
      page = $page.Key
      pageLabel = $page.Value
      viewport = $viewport.Key
      viewportLabel = $viewport.Value.label
      width = $viewport.Value.width
      height = $viewport.Value.height
      file = $fileName
    }
  }
}

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  source = $sourcePath
  pageCount = $pages.Count
  viewportCount = $viewports.Count
  exportCount = $manifestEntries.Count
  exports = $manifestEntries
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destinationPath "manifest.json") -Encoding UTF8

Write-Output "Exported $($manifestEntries.Count) previews to $destinationPath"
