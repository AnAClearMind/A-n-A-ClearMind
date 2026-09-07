# ClearMind Developer Tools: HTML Sample Analyzer

A developer utility to analyze saved `.html` page snapshots using the ClearMind Content Scanner algorithm ([`src/scripts/global/contentScanner.js`](../src/scripts/global/contentScanner.js)) and the current keyword database ([`src/DB/adult-keywords.json`](../src/DB/adult-keywords.json)).

---

## Features
- Analyzes individual `.html` files or entire directories of snapshots in batch.
- Exact parity with the extension's content scanning pipeline:
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
