#!/usr/bin/env python3
"""
ClearMind Content Filter — HTML Sample Analyzer
================================================
Analyzes saved .html page snapshots using the exact Content Scanner algorithm
and the current adult-keywords.json database.

Features:
- Single file or batch directory analysis
- Exact parity with src/scripts/global/contentScanner.js
- Human-readable CLI summary or clean JSON output for AI agents (--json)
- Displays matched terms, repeat counts, score breakdown, and pruned foreign terms

Usage:
  python tools/analyze_samples.py
  python tools/analyze_samples.py test_sampels/
  python tools/analyze_samples.py "test_sampels/sample.html"
  python tools/analyze_samples.py test_sampels/ --json
"""

import sys
import os
import glob
import json
import re
import argparse
import unicodedata
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Error: BeautifulSoup4 is required. Please install it with: pip install beautifulsoup4", file=sys.stderr)
    sys.exit(1)

# Paths
REPO_ROOT = Path(__file__).resolve().parent.parent
KEYWORDS_PATH = REPO_ROOT / "src" / "DB" / "adult-keywords.json"
DEFAULT_SAMPLES_DIR = REPO_ROOT / "test_sampels"

# Algorithm Constants (matching contentScanner.js)
BLOCK_THRESHOLD = 40
RESCAN_THRESHOLD = 24
MAX_TEXT_LENGTH = 100000

CATEGORY_WEIGHTS = {
    "strong": 6,
    "medium": 5
}

SOURCE_MULTIPLIERS = {
    "titleMeta": 2.0,
    "headings": 1.5,
    "linksButtons": 1.0,
    "body": 1.0,
    "path": 0.5
}

SCRIPT_FILTERS = {
    "ru": re.compile(r"[а-яё]", re.IGNORECASE),
    "ar": re.compile(r"[\u0600-\u06FF]"),
    "hi": re.compile(r"[\u0900-\u097F]"),
    "zh-Hans": re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF]"),
    "ja": re.compile(r"[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]"),
    "ko": re.compile(r"[\uAC00-\uD7AF\u1100-\u11FF]"),
    "en": re.compile(r"[a-z]", re.IGNORECASE),
    "es": re.compile(r"[a-z]", re.IGNORECASE),
    "fr": re.compile(r"[a-z]", re.IGNORECASE),
    "de": re.compile(r"[a-z]", re.IGNORECASE),
    "pt": re.compile(r"[a-z]", re.IGNORECASE),
    "it": re.compile(r"[a-z]", re.IGNORECASE),
    "pl": re.compile(r"[a-z]", re.IGNORECASE),
    "tr": re.compile(r"[a-z]", re.IGNORECASE)
}

GENERIC_ALTS = re.compile(
    r"^(image|photo|picture|thumbnail|logo|icon|avatar|star|full star|half star|empty star|banner|pic|img)$",
    re.IGNORECASE
)


def normalize_text(text):
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFD", str(text))
    without_diacritics = "".join(c for c in nfkd if not unicodedata.combining(c))
    cleaned = without_diacritics.lower()
    cleaned = re.sub(r"[\x00-\x1f]+", " ", cleaned)
    cleaned = re.sub(r"[\-_./]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def load_and_compile_keywords(db_path):
    if not os.path.isfile(db_path):
        raise FileNotFoundError(f"Keyword DB not found at: {db_path}")

    with open(db_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    compiled = {"languages": {}}
    cjk_pattern = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]")

    for lang_code, categories in data.get("languages", {}).items():
        compiled["languages"][lang_code] = {}
        for category in ["strong", "medium"]:
            words = categories.get(category, [])
            compiled_words = []
            for word in words:
                norm = normalize_text(word)
                escaped = re.escape(norm)
                escaped = re.sub(r"\s+", r"\\s+", escaped)
                is_cjk = bool(cjk_pattern.search(word))
                is_latin_short_foreign = (
                    lang_code != "en" and
                    len(norm) <= 4 and
                    bool(re.match(r"^[a-z0-9\s-]+$", norm))
                )

                if is_cjk:
                    regex = re.compile(escaped, re.IGNORECASE)
                    global_regex = re.compile(escaped, re.IGNORECASE)
                else:
                    regex = re.compile(r"(^|[^\w])(" + escaped + r")([^\w]|$)", re.IGNORECASE)
                    global_regex = re.compile(r"(^|[^\w])(" + escaped + r")(?=[^\w]|$)", re.IGNORECASE)

                compiled_words.append({
                    "original": word,
                    "normalized": norm,
                    "is_latin_short_foreign": is_latin_short_foreign,
                    "regex": regex,
                    "global_regex": global_regex
                })
            compiled["languages"][lang_code][category] = compiled_words

    return compiled


def extract_text_sources(soup, file_path=""):
    title = soup.title.string.strip() if soup.title and soup.title.string else ""

    meta_parts = []
    for meta in soup.find_all("meta"):
        key = (meta.get("name") or meta.get("property") or "").lower()
        if key in [
            "description", "keywords",
            "og:title", "og:description",
            "twitter:title", "twitter:description"
        ]:
            content = meta.get("content", "").strip()
            if content:
                meta_parts.append(content)

    headings_parts = []
    for h in soup.find_all(["h1", "h2", "h3"]):
        txt = h.get_text(separator=" ", strip=True)
        if txt:
            headings_parts.append(txt)

    links_parts = []
    for el in soup.find_all(["a", "button"])[:300]:
        t = el.get_text(separator=" ", strip=True)
        if t:
            links_parts.append(t)
        title_attr = (el.get("title") or "").strip()
        if title_attr and title_attr != t:
            links_parts.append(title_attr)

    img_alts = []
    for img in soup.find_all("img")[:50]:
        alt = (img.get("alt") or "").strip()
        if len(alt) > 2 and not GENERIC_ALTS.match(alt):
            img_alts.append(alt)

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    body_text = soup.body.get_text(separator=" ", strip=True) if soup.body else ""

    path_text = ""
    if file_path:
        path_text = Path(file_path).name

    all_title_meta = " ".join([title] + meta_parts)
    all_links = " ".join(links_parts + img_alts)

    return {
        "titleMeta": all_title_meta[:20000],
        "headings": " ".join(headings_parts)[:20000],
        "linksButtons": all_links[:25000],
        "body": body_text[:MAX_TEXT_LENGTH],
        "path": path_text[:5000],
        "_meta": {
            "title": title,
            "meta_description": meta_parts[0] if meta_parts else "",
            "headings_count": len(headings_parts),
            "links_count": len(links_parts),
            "img_alts_count": len(img_alts)
        }
    }


def analyze_html_file(file_path, compiled_db, block_threshold=BLOCK_THRESHOLD):
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, "html.parser")
    page_lang = (soup.html.get("lang") or "").strip().lower() if soup.html else ""

    sources = extract_text_sources(soup, file_path=file_path)
    meta_info = sources.pop("_meta")

    summary = {
        "raw_score": 0.0,
        "score": 0.0,
        "is_blocked": False,
        "blocking_rule": None,
        "has_header_strong": False,
        "matched_languages": {},
        "matched_categories": {"strong": 0, "medium": 0},
        "matched_terms": {},
        "language_term_counts": {},
        "matched_language_terms": {},
        "potential_foreign_short_matches": []
    }

    term_details = {}

    for source_name, text in sources.items():
        norm_text = normalize_text(text)
        if not norm_text:
            continue

        multiplier = SOURCE_MULTIPLIERS.get(source_name, 1.0)
        source_matched_keywords = {}

        for lang_code, categories in compiled_db["languages"].items():
            filter_regex = SCRIPT_FILTERS.get(lang_code)
            if filter_regex and not filter_regex.search(norm_text):
                continue

            for category in ["strong", "medium"]:
                category_matches = 0
                for kw_obj in categories[category]:
                    if category_matches >= 5:
                        break

                    match_key = f"{category}:{kw_obj['original']}"
                    if match_key in source_matched_keywords:
                        continue

                    if kw_obj["regex"].search(norm_text):
                        source_matched_keywords[match_key] = True
                        category_matches += 1

                        all_hits = kw_obj["global_regex"].findall(norm_text)
                        match_count = len(all_hits)
                        extra_matches = min(max(0, match_count - 1), 3)
                        repeat_bonus = extra_matches * 1.0
                        pts = (CATEGORY_WEIGHTS[category] + repeat_bonus) * multiplier

                        summary["raw_score"] += pts
                        summary["matched_languages"][lang_code] = True
                        summary["matched_categories"][category] += 1
                        summary["matched_terms"][match_key] = True

                        lang_term_key = f"{lang_code}:{kw_obj['original']}"
                        if lang_term_key not in summary["matched_language_terms"]:
                            summary["matched_language_terms"][lang_term_key] = True
                            summary["language_term_counts"][lang_code] = summary["language_term_counts"].get(lang_code, 0) + 1

                        if category == "strong" and source_name in ["titleMeta", "headings"]:
                            summary["has_header_strong"] = True

                        if match_key not in term_details:
                            term_details[match_key] = {
                                "term": kw_obj["original"],
                                "category": category,
                                "language": lang_code,
                                "total_occurrences": 0,
                                "total_points": 0.0,
                                "sources": []
                            }

                        term_details[match_key]["total_occurrences"] += match_count
                        term_details[match_key]["total_points"] += pts
                        term_details[match_key]["sources"].append(f"{source_name}(+{pts:.1f}pts, x{match_count})")

                        if kw_obj["is_latin_short_foreign"]:
                            summary["potential_foreign_short_matches"].append({
                                "lang": lang_code,
                                "termKey": match_key,
                                "points": pts,
                                "category": category
                            })

    summary["score"] = summary["raw_score"]

    # Prune isolated short foreign Latin terms on non-matching language pages
    pruned_terms = []
    for item in summary["potential_foreign_short_matches"]:
        if not page_lang.startswith(item["lang"]) and summary["language_term_counts"].get(item["lang"], 0) < 2:
            summary["score"] -= item["points"]
            summary["matched_categories"][item["category"]] -= 1
            summary["matched_terms"].pop(item["termKey"], None)
            if summary["language_term_counts"].get(item["lang"], 0) <= 1:
                summary["matched_languages"].pop(item["lang"], None)
            pruned_terms.append({
                "termKey": item["termKey"],
                "lang": item["lang"],
                "points_deducted": item["points"],
                "reason": f"Isolated short foreign term ('{item['termKey']}') on non-matching page lang ('{page_lang or 'unknown'}')"
            })
            term_details.pop(item["termKey"], None)

    distinct_terms_count = len(summary["matched_terms"])
    score = summary["score"]

    # Decision Matrix
    is_blocked = False
    rule_name = None

    if distinct_terms_count >= 5:
        is_blocked = True
        rule_name = "distinct_terms_gte_5"
    elif distinct_terms_count >= 4 and score >= block_threshold:
        is_blocked = True
        rule_name = "distinct_terms_4_and_score_gte_threshold"
    elif distinct_terms_count >= 3 and score >= 50:
        is_blocked = True
        rule_name = "distinct_terms_3_and_score_gte_50"
    elif distinct_terms_count >= 2 and score >= 70:
        is_blocked = True
        rule_name = "distinct_terms_2_and_score_gte_70"
    elif summary["has_header_strong"] and distinct_terms_count >= 2 and score >= block_threshold:
        is_blocked = True
        rule_name = "header_strong_and_distinct_gte_2_and_score_gte_threshold"

    if not is_blocked:
        score = min(score, RESCAN_THRESHOLD - 1)

    return {
        "file_path": str(file_path),
        "file_name": Path(file_path).name,
        "title": meta_info["title"],
        "page_lang": page_lang or "unspecified",
        "score": round(score),
        "raw_score": round(summary["raw_score"]),
        "is_blocked": is_blocked,
        "blocking_rule": rule_name,
        "distinct_terms_count": distinct_terms_count,
        "has_header_strong": summary["has_header_strong"],
        "matched_categories": summary["matched_categories"],
        "matched_languages": list(summary["matched_languages"].keys()),
        "distinct_terms": list(term_details.values()),
        "pruned_terms": pruned_terms,
        "meta": meta_info
    }


def format_cli_result(res):
    border = "=" * 80
    status = "🔴 BLOCKED" if res["is_blocked"] else "🟢 ALLOWED (PASS)"
    lines = [
        border,
        f"File:   {res['file_name']}",
        f"Title:  {res['title'] or '(no title)'}",
        f"Lang:   {res['page_lang']}",
        "",
        f"Verdict: {status}",
        f"Score:   {res['score']} pts (Raw: {res['raw_score']}) | Threshold: {BLOCK_THRESHOLD}",
        f"Rule:    {res['blocking_rule'] or 'None (clamped to safe threshold)'}",
        f"Header Strong: {'Yes' if res['has_header_strong'] else 'No'}",
        f"Distinct Terms ({res['distinct_terms_count']}):"
    ]

    if res["distinct_terms"]:
        for t in res["distinct_terms"]:
            sources_str = ", ".join(t["sources"])
            lines.append(f"  • [{t['language']}] [{t['category']}] \"{t['term']}\": {t['total_occurrences']} hit(s), +{t['total_points']:.1f} pts ({sources_str})")
    else:
        lines.append("  (No adult terms matched)")

    if res["pruned_terms"]:
        lines.append("")
        lines.append("Pruned Terms (False Positive Guard):")
        for p in res["pruned_terms"]:
            lines.append(f"  ⚠️ {p['termKey']} (-{p['points_deducted']:.1f} pts) — {p['reason']}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="ClearMind Content Scanner HTML Snapshot Analyzer")
    parser.add_argument("target", nargs="?", default=str(DEFAULT_SAMPLES_DIR),
                        help="Path to an .html file or a folder of .html files (default: test_sampels/)")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")
    parser.add_argument("--threshold", type=int, default=BLOCK_THRESHOLD, help="Custom block threshold (default: 40)")
    parser.add_argument("--keywords-db", default=str(KEYWORDS_PATH), help="Path to adult-keywords.json")
    args = parser.parse_args()

    target_path = Path(args.target)
    html_files = []

    if target_path.is_file():
        if target_path.suffix.lower() == ".html":
            html_files.append(target_path)
        else:
            print(f"Error: Target '{target_path}' is not an HTML file.", file=sys.stderr)
            sys.exit(1)
    elif target_path.is_dir():
        html_files = sorted(list(target_path.glob("*.html")))
        if not html_files:
            # Recursive check if no files in top folder
            html_files = sorted(list(target_path.rglob("*.html")))
    else:
        # Glob pattern support
        matched = glob.glob(str(target_path))
        html_files = [Path(p) for p in matched if p.lower().endswith(".html")]

    if not html_files:
        if args.json:
            print(json.dumps({"error": f"No .html files found in '{args.target}'"}, indent=2))
        else:
            print(f"No .html files found at: {args.target}")
        sys.exit(0)

    try:
        compiled_db = load_and_compile_keywords(args.keywords_db)
    except Exception as e:
        print(f"Error loading keywords DB: {e}", file=sys.stderr)
        sys.exit(1)

    results = []
    blocked_count = 0

    for file_p in html_files:
        try:
            res = analyze_html_file(file_p, compiled_db, block_threshold=args.threshold)
            results.append(res)
            if res["is_blocked"]:
                blocked_count += 1
            if not args.json:
                print(format_cli_result(res))
        except Exception as e:
            if args.json:
                results.append({"file": str(file_p), "error": str(e)})
            else:
                print(f"Error analyzing {file_p}: {e}", file=sys.stderr)

    total = len(results)
    if args.json:
        output = {
            "summary": {
                "total_files": total,
                "blocked_files": blocked_count,
                "allowed_files": total - blocked_count,
                "block_rate_percent": round((blocked_count / total * 100), 1) if total else 0
            },
            "results": results
        }
        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        print("=" * 80)
        print(f"Batch Summary: {blocked_count}/{total} sample(s) blocked ({round(blocked_count / total * 100 if total else 0, 1)}%)")
        print("=" * 80)


if __name__ == "__main__":
    main()
