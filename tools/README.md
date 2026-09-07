# ClearMind Developer Tools: HTML Sample Analyzer

A developer utility to analyze saved `.html` page snapshots using the ClearMind Content Scanner algorithm ([`src/scripts/global/contentScanner.js`](../src/scripts/global/contentScanner.js)) and the current keyword database ([`src/DB/adult-keywords.json`](../src/DB/adult-keywords.json)).

---

## Features
- Analyzes individual `.html` files or entire directories of snapshots in batch.
- Scoring rules checked against the production JavaScript scanner on shared regression fixtures:
  - Extracts title, OpenGraph, and Twitter meta tags, heading tags `h1..h3`, link tags `<a>`, button tags `<button>`, link title attributes (`a[title]`), and image alt text (`img[alt]`).
  - Respects page language declaration (`<html lang>`).
  - Implements the cross-language short-term guard (prunes isolated foreign words like French `pipe` on English pages to prevent false positives).
  - Calculates repetition bonuses for high-frequency terms in gallery/grid pages.
  - Evaluates the tiered decision matrix for blocking.
- Dual output formats:
  - **Human-readable CLI**: Visual terminal output with a full breakdown of matched terms, occurrence counts, score contributions, and pruned false-positive terms.
  - **AI Agent-friendly JSON (`--json`)**: Clean structured JSON output to stdout for direct consumption and decision-making by automated agents without log parsing.

---

## Usage

### 1. Default Run (Analyzes all files in `test_sampels/`)
```bash
# Via Python:
python tools/analyze_samples.py

# Or via Windows batch script:
tools\analyze_samples.bat
```

### 2. Analyze a Specific HTML File
```bash
python tools/analyze_samples.py "test_sampels/sample.html"
```

To include the original URL path in scoring:
```bash
python tools/analyze_samples.py "test_sampels/sample.html" --url "https://example.org/original/path" --json
```

Without `--url`, path scoring is omitted; the saved filename never contributes to the score. `--url` accepts one HTML file at a time.

This is a snapshot scoring tool: it does not execute page scripts, simulate later DOM changes, or apply extension settings, domain exemptions, or network rules. The HTML parser can also differ from a browser on malformed markup. Use the extension in Chromium and Firefox to verify the final browsing behavior.

### 3. Analyze a Custom Directory
```bash
python tools/analyze_samples.py "C:\path\to\downloaded_samples"
```

### 4. Machine/Agent JSON Mode (`--json`)
```bash
python tools/analyze_samples.py test_sampels/ --json
```

Example JSON output:
```json
{
  "summary": {
    "total_files": 1,
    "blocked_files": 1,
    "allowed_files": 0,
    "block_rate_percent": 100.0
  },
  "results": [
    {
      "file_name": "sample.html",
      "score": 113,
      "is_blocked": true,
      "blocking_rule": "distinct_terms_gte_5",
      "distinct_terms_count": 6,
      "distinct_terms": [ ... ],
      "pruned_terms": [ ... ]
    }
  ]
}
```

---

## Requirements
- Python 3.8+
- `beautifulsoup4` (`pip install beautifulsoup4`)

## Regression checks
Run `node tests/run-all.mjs` and `python -B tests/test_analyzer.py` from the repository root. The Python tests also require Node.js to compare scores with the actual extension scanner.

The CLI exits with a nonzero status if input files are missing or analysis fails. JSON summaries report failed inputs in `error_files`, separately from `allowed_files`.
