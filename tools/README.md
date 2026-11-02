# ClearMind scanner development tools

## Current content scanner

Validate current behavior with the installed extension in Chromium and Firefox.
Optional regression runners, fixtures, and comparison reports are maintained locally
and are not distributed with this repository.

### Scoring and deliberate tradeoffs

- Exact `head` rating `adult` or `RTA-5042-1996-1400-1577-RTA` is sufficient to block.
  Other age labels and quoted/body markup are insufficient.
- Unicode uses NFKD for both dictionary and text; zero-width characters are unchanged.
- Metadata contained in another metadata value is counted once. Unique descriptions
  survive. One DOM text node belongs to exactly one source. Page title and visible
  heading remain separate evidence; this does not solve every medical/news FP.
- DOM traversal stops at a shared 100,000-character prefix, including invisible text
  in that traversal budget. Headings/links after the prefix are no longer collected
  separately. This bounds work but may lose late evidence on very long pages.
- Hidden text contributes zero. `class`, `style`, `hidden`, and `open` mutations rescan.
  CSS-only changes with no observed mutation (for example a media query or delayed
  stylesheet load) are not guaranteed to trigger a scan. No shadow DOM/frame traversal.
- Context-required words need an explicit match within 150 normalized characters in
  the same continuous DOM block and source. Separate paragraphs/cards do not corroborate.
- Longest overlapping phrase wins at each span; duplicates in different languages are
  resolved deterministically. Per-source/language/category top five prioritize explicit
  terms, then contribution. Ordinary synonyms elsewhere remain separate terms.
- Navigation/footer/sidebar weight is 0.35, body and links 1, headings 1.5, title/meta 2,
  path 0.5. Existing combination gates and final threshold 40 remain. These weights
  require field calibration; navigation-only adult catalogs can lose detection.
- Reddit scans each visible post independently. Permalink pages use only the matching
  post; feeds block when any individual post qualifies. Comments and sidebars are excluded.
  NSFW needs strong sexual evidence and score 40; unflagged posts need score 60.
  Modern `shreddit-post`, old `.thing.link`, and `[data-testid="post-container"]` are
  supported conservatively. Unrecognized layouts and text-free posts remain gaps.

### Local block diagnostics

The newest 50 `chrome.storage.local.contentScanDetections` entries include `diagnostics`:
scanner/dictionary versions, decision rule, raw score before the combination cap,
distinct term count, and up to eight dictionary terms with source, contribution, and
occurrence count. Marker rules can have raw lexical score zero and final score 40.
No page excerpts or full URLs are added to the log, and there is no automatic upload.
From the extension service-worker console:

```js
chrome.storage.local.get('contentScanDetections', console.log);
```

## Legacy Python snapshot analyzer (scanner v1)

This utility is intentionally frozen to the earlier algorithm and dictionary v8 for
historical comparisons. It does **not** model scanner v2. Use the installed extension
for current decisions; a static BeautifulSoup parser cannot verify computed CSS visibility
or live Reddit/SPA behavior. `--keywords-db` can vary the legacy dictionary only.

---

## Features
- Analyzes individual `.html` files or entire directories of snapshots in batch.
- Legacy scoring rules:
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

The CLI exits with a nonzero status if input files are missing or analysis fails. JSON summaries report failed inputs in `error_files`, separately from `allowed_files`.
