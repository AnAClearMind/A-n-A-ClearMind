param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Chrome', 'Firefox')]
    [string]$Browser
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $repoRoot 'src'
$outDir = Join-Path $repoRoot 'builds'
$files = @{}

foreach ($directory in '_locales', 'assets', 'DB', 'pages', 'scripts') {
    Get-ChildItem -LiteralPath (Join-Path $sourceRoot $directory) -File -Recurse -Force | ForEach-Object {
        $entryName = $_.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
        $files[$entryName] = $_.FullName
    }
}
$files['manifest.json'] = Join-Path $sourceRoot 'manifest.json'

if ($Browser -eq 'Firefox') {
    $overlayRoot = Join-Path $sourceRoot '(firefox_specific)'
    Get-ChildItem -LiteralPath $overlayRoot -File -Recurse -Force | ForEach-Object {
        $entryName = $_.FullName.Substring($overlayRoot.Length + 1).Replace('\', '/')
        $files[$entryName] = $_.FullName
    }
}

$manifest = Get-Content -LiteralPath $files['manifest.json'] -Raw -Encoding UTF8 | ConvertFrom-Json
$date = Get-Date -Format 'yyyy-MM-dd'
$outFile = Join-Path $outDir ('{0}_{1}_{2}.zip' -f $Browser, $manifest.version, $date)
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$tempFile = Join-Path $outDir ([guid]::NewGuid().ToString() + '.tmp')

try {
    $archive = [System.IO.Compression.ZipFile]::Open($tempFile, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($entryName in ($files.Keys | Sort-Object)) {
            # Windows PowerShell 5.1 Compress-Archive writes backslashes, rejected by Mozilla.
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive, $files[$entryName], $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    }
    finally {
        $archive.Dispose()
    }
    Move-Item -LiteralPath $tempFile -Destination $outFile -Force
    Write-Host "$Browser build complete: $outFile"
}
finally {
    if (Test-Path -LiteralPath $tempFile) {
        Remove-Item -LiteralPath $tempFile -Force
    }
}
