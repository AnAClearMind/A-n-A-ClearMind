(function () {
    const KEYWORD_DB_PATH = 'DB/adult-keywords.json';
    const BLOCK_THRESHOLD = 40;
    const RESCAN_THRESHOLD = 24;
    const MAX_TEXT_LENGTH = 100000;
    const MAX_RESCANS = 3;
    const RESCAN_DELAY_MS = 1500;
    const MUTATION_DEBOUNCE_MS = 1500;
    const MUTATION_MAX_WAIT_MS = 5000;
    const BUILT_IN_ALLOWED_DOMAINS = [
        'google.com',
        'bing.com',
        'duckduckgo.com',
        'yahoo.com',
        'yandex.com',
        'ya.ru',
        'yandex.ru',
        'baidu.com',
        'brave.com',
        'youtube.com',
        'facebook.com',
        'instagram.com',
        'threads.net',
        'tiktok.com',
        'discord.com',
        'linkedin.com',
        'pinterest.com',
        'quora.com',
        'medium.com',
        'substack.com',
        'github.com',
        'stackoverflow.com',
        'twitch.tv',
        'search.brave.com',
        'startpage.com',
        'ecosia.org',
        'qwant.com',
        'mojeek.com',
        'searx.org',
        'wikipedia.org',
        'wikimedia.org',
        'researchgate.net',
        'pubmed.ncbi.nlm.nih.gov',
        'pmc.ncbi.nlm.nih.gov',
        'arxiv.org',
        'biorxiv.org',
        'medrxiv.org',
        'redd.it',
        'nofap.com',
        'forum.nofap.com',
        'yourbrainonporn.com',
        'rebootnation.org',
        'news.google.com',
        'news.ycombinator.com',
        'bbc.co.uk',
        'bbc.com',
        'cnn.com',
        'reuters.com',
        'apnews.com',
        'theguardian.com',
        'nytimes.com',
        'washingtonpost.com',
        'bloomberg.com',
        'forbes.com',
        'wsj.com',
        'ft.com',
        'independent.co.uk',
        'telegraph.co.uk',
        'dailymail.co.uk',
        'usatoday.com',
        'nbcnews.com',
        'cbsnews.com',
        'foxnews.com',
        'abcnews.go.com',
        'aljazeera.com',
        'dw.com',
        'euronews.com',
        'lemonde.fr',
        'spiegel.de',
        'rbc.ru',
        'ria.ru',
        'tass.ru',
        'kommersant.ru',
        'vedomosti.ru',
        'lenta.ru',
        'gazeta.ru',
        'interfax.ru',
        'meduza.io',
        'fontanka.ru',
        'habr.com'
    ];
    const SFW_AESTHETIC_REGEX = /(^|[^\p{L}\p{N}])(?:unix|desktop|food|earth|room|design|map|space)\s*porn(?:ography)?(?=[^\p{L}\p{N}]|$)/gu;
    const SOURCE_MULTIPLIERS = {
        titleMeta: 2,
        headings: 1.5,
        linksButtons: 1,
        body: 1,
        path: 0.5,
        navigation: 0.35
    };
    const CATEGORY_WEIGHTS = {
        strong: 6,
        medium: 5
    };
    const SCRIPT_FILTERS = {
        ru: /[а-яё]/i,
        ar: /[\u0600-\u06FF]/,
        hi: /[\u0900-\u097F]/,
        'zh-Hans': /[\u3400-\u4DBF\u4E00-\u9FFF]/,
        ja: /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/,
        ko: /[\uAC00-\uD7AF\u1100-\u11FF]/,
        en: /[a-z]/i,
        es: /[a-z]/i,
        fr: /[a-z]/i,
        de: /[a-z]/i,
        pt: /[a-z]/i,
        it: /[a-z]/i,
        pl: /[a-z]/i,
        tr: /[a-z]/i
    };


    let keywordDb = null;
    let scanFinished = false;
    let scanCount = 0;
    let mutationTimer = null;
    let pendingMutationSince = null;
    let lastScanTime = 0;
    let scannerEnabled = false;
    let settingsRevision = 0;
    let observer = null;
    let routeTimer = null;
    let restoreBlockedPage = null;

    if (!shouldScanCurrentPage()) {
        return;
    }

    chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName === 'local' && ('contentScanningEnabled' in changes || 'contentScanAllowedDomains' in changes)) {
            refreshScannerSettings();
        }
    });
    refreshScannerSettings();

    function refreshScannerSettings() {
        const revision = ++settingsRevision;
        getScannerSettings(function (settings) {
            if (revision !== settingsRevision) return;
            scannerEnabled = settings.enabled && !isAllowedDomain(location.hostname, settings.allowedDomains);
            if (!scannerEnabled) {
                window.clearTimeout(mutationTimer);
                window.clearInterval(routeTimer);
                if (observer) observer.disconnect();
                observer = null;
                pendingMutationSince = null;
                if (restoreBlockedPage) restoreBlockedPage();
                scanFinished = false;
                return;
            }
            if (observer) return;
            loadKeywordDb().then(function (db) {
                keywordDb = db;
                if (!scannerEnabled || observer) return;
                scanCount = 0;
                observeDynamicContent();
                runScanWithRescan();
            }).catch(function (error) {
                console.warn('ClearMind content scanner could not load keyword DB:', error);
            });
        });
    }

    function shouldScanCurrentPage() {
        const protocol = location.protocol;
        return protocol === 'http:' || protocol === 'https:';
    }

    function getScannerSettings(callback) {
        chrome.storage.local.get(['contentScanningEnabled', 'contentScanAllowedDomains'], function (result) {
            callback({
                enabled: result && typeof result.contentScanningEnabled !== 'undefined' ? result.contentScanningEnabled !== false : true,
                allowedDomains: Array.isArray(result && result.contentScanAllowedDomains) ? result.contentScanAllowedDomains : []
            });
        });
    }

    function isAllowedDomain(hostname, allowedDomains) {
        const normalizedHostname = normalizeHostname(hostname);
        return BUILT_IN_ALLOWED_DOMAINS.concat(allowedDomains).some(function (domain) {
            const normalizedDomain = normalizeHostname(domain);
            return normalizedHostname === normalizedDomain || normalizedHostname.endsWith('.' + normalizedDomain);
        });
    }



    function normalizeHostname(hostname) {
        return String(hostname || '').toLowerCase().replace(/^www\./, '');
    }

    function loadKeywordDb() {
        if (keywordDb) {
            return Promise.resolve(keywordDb);
        }

        return fetch(chrome.runtime.getURL(KEYWORD_DB_PATH)).then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.text();
        }).then(function (rawJson) {
            const parsed = JSON.parse(rawJson);
            const compiledDb = { version: parsed.version, languages: {} };
            const contextRequired = new Set((parsed.contextRequired || []).map(normalizeText));
            const langs = parsed.languages || {};

            Object.keys(langs).forEach(function (langCode) {
                compiledDb.languages[langCode] = {};
                const lang = langs[langCode];
                ['strong', 'medium'].forEach(function (category) {
                    const keywords = Array.isArray(lang[category]) ? lang[category] : [];
                    compiledDb.languages[langCode][category] = keywords.map(function (kw) {
                        const normalized = normalizeText(kw);
                        const escaped = escapeRegex(normalized).replace(/\s+/g, '\\s+');
                        const isCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(kw);
                        const isLatinShortForeign = (langCode !== 'en' && normalized.length <= 4 && /^[a-z0-9\s-]+$/i.test(normalized));
                        return {
                            original: kw,
                            normalized: normalized,
                            isCjk: isCjk,
                            requiresContext: contextRequired.has(normalized),
                            isLatinShortForeign: isLatinShortForeign,
                            regex: isCjk
                                ? new RegExp(escaped, 'iu')
                                : new RegExp('(^|[^\\p{L}\\p{N}])(' + escaped + ')([^\\p{L}\\p{N}]|$)', 'iu'),
                            globalRegex: isCjk
                                ? new RegExp(escaped, 'giu')
                                : new RegExp('(^|[^\\p{L}\\p{N}])(' + escaped + ')(?=[^\\p{L}\\p{N}]|$)', 'giu')
                        };
                    }).sort(function (a, b) {
                        // Spend the per-category match budget on explicit evidence first.
                        return Number(a.requiresContext) - Number(b.requiresContext);
                    });
                });
            });
            return compiledDb;
        });
    }

    function runScanWithRescan() {
        if (!scannerEnabled || scanFinished || !keywordDb) {
            return;
        }

        window.clearTimeout(mutationTimer);
        pendingMutationSince = null;
        lastScanTime = Date.now();
        scanCount += 1;
        const result = scanPage();

        if (result.score >= BLOCK_THRESHOLD) {
            scanFinished = true;
            window.clearTimeout(mutationTimer);
            reportBlockedPage(result);
            return;
        }

        if (result.score >= RESCAN_THRESHOLD && scanCount < MAX_RESCANS) {
            mutationTimer = window.setTimeout(runScanWithRescan, RESCAN_DELAY_MS);
        }
    }

    function scheduleDynamicScan() {
        if (!scannerEnabled || scanFinished) {
            return;
        }
        const now = Date.now();
        if (pendingMutationSince === null) {
            pendingMutationSince = now;
        }
        // Limit both scan frequency and how long continuous updates can postpone a scan.
        const deadline = Math.max(lastScanTime + MUTATION_DEBOUNCE_MS,
            Math.min(now + MUTATION_DEBOUNCE_MS, pendingMutationSince + MUTATION_MAX_WAIT_MS));
        scanCount = 0;
        window.clearTimeout(mutationTimer);
        mutationTimer = window.setTimeout(runScanWithRescan, Math.max(0, deadline - now));
    }

    function observeDynamicContent() {
        if (!document.body || scanFinished) {
            return;
        }

        observer = new MutationObserver(scheduleDynamicScan);

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['alt', 'title', 'content', 'lang', 'class', 'style', 'hidden', 'open', 'name', 'nsfw', 'data-nsfw', 'post-title']
        });

        // pushState does not emit popstate, and a route can change without DOM mutations.
        let lastUrl = location.href;
        routeTimer = window.setInterval(function () {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                scheduleDynamicScan();
            }
        }, MUTATION_DEBOUNCE_MS);
    }

    function scanPage() {
        const isReddit = /(^|\.)reddit\.com$/i.test(location.hostname);
        if (!isReddit) {
            const result = scoreBlocks(collectTextSources(document.body, true));
            const rating = getAdultRating();
            if (rating) {
                result.score = Math.max(BLOCK_THRESHOLD, result.score);
                result.rule = rating;
            }
            return result;
        }

        // Never combine unrelated posts, comments, or sidebar recommendations.
        const postId = (location.pathname.match(/\/comments\/([a-z0-9]+)/i) || [])[1];
        const posts = Array.from(document.querySelectorAll('shreddit-post, .thing.link, [data-testid="post-container"]'));
        let best = scoreBlocks([]);
        posts.forEach(function (post) {
            if (post.closest('aside, nav, footer, [slot="related-posts"]') || !isVisible(post)) return;
            if (postId) {
                const id = (post.getAttribute('data-fullname') || post.getAttribute('id') || '').replace(/^(?:thing_)?t3_/, '');
                const permalink = post.getAttribute('permalink') || '';
                if (id !== postId && !permalink.includes('/comments/' + postId + '/')) return;
            }
            let blocks = collectTextSources(post, false);
            const postTitle = post.getAttribute('post-title');
            if (postTitle) {
                blocks = blocks.filter(function (block) {
                    return block.source !== 'headings' || normalizeText(block.text) !== normalizeText(postTitle);
                });
                blocks.push({ source: 'titleMeta', text: postTitle });
            }
            const result = scoreBlocks(blocks);
            const nsfw = (post.hasAttribute('nsfw') && post.getAttribute('nsfw') !== 'false') ||
                post.getAttribute('data-nsfw') === 'true' || post.classList.contains('over18');
            const confident = result.score >= (nsfw ? BLOCK_THRESHOLD : 60) && result.matchedCategories.strong > 0;
            if (confident) result.rule = 'reddit_post_' + result.rule;
            else result.score = Math.min(result.score, RESCAN_THRESHOLD - 1);
            if (result.score > best.score) best = result;
        });
        return best;
    }

    function getAdultRating() {
        if (!document.head) return null;
        const tags = document.head.querySelectorAll('meta[name="rating" i]');
        for (const tag of tags) {
            const value = (tag.getAttribute('content') || '').trim().toLowerCase();
            if (value === 'adult') return 'meta_rating_adult';
            if (value === 'rta-5042-1996-1400-1577-rta') return 'meta_rating_rta';
        }
        return null;
    }

    function scoreBlocks(blocks) {
        const pageLang = (document.documentElement.lang || '').toLowerCase();
        const languageTerms = {};
        const matchesByBlock = blocks.map(function (block) {
            const text = normalizeText(block.text);
            const matches = [];
            Object.keys(keywordDb.languages).sort().forEach(function (lang) {
                if (SCRIPT_FILTERS[lang] && !SCRIPT_FILTERS[lang].test(text)) return;
                ['strong', 'medium'].forEach(function (category) {
                    keywordDb.languages[lang][category].forEach(function (kw) {
                        kw.globalRegex.lastIndex = 0;
                        let match;
                        while ((match = kw.globalRegex.exec(text))) {
                            const start = match.index + (kw.isCjk ? 0 : match[1].length);
                            const length = kw.isCjk ? match[0].length : match[2].length;
                            matches.push({ start: start, end: start + length, kw: kw, lang: lang, category: category });
                            if (!languageTerms[lang]) languageTerms[lang] = new Set();
                            languageTerms[lang].add(kw.normalized);
                        }
                    });
                });
            });
            return { block: block, text: text, matches: matches };
        });

        const evidence = new Map();
        matchesByBlock.forEach(function (entry) {
            const matches = entry.matches.filter(function (m) {
                return !m.kw.isLatinShortForeign || pageLang.startsWith(m.lang) || languageTerms[m.lang].size >= 2;
            });
            // Resolve shared spans before counting distinct terms. Exact duplicate translations
            // prefer the declared language; otherwise tie-breaking is independent of JSON order.
            matches.sort(function (a, b) {
                return (b.end - b.start) - (a.end - a.start) ||
                    Number(a.kw.requiresContext) - Number(b.kw.requiresContext) ||
                    CATEGORY_WEIGHTS[b.category] - CATEGORY_WEIGHTS[a.category] ||
                    Number(pageLang.startsWith(b.lang)) - Number(pageLang.startsWith(a.lang)) ||
                    (a.kw.normalized + a.lang).localeCompare(b.kw.normalized + b.lang);
            });
            const occupied = new Uint8Array(entry.text.length);
            const accepted = [];
            matches.forEach(function (m) {
                if (occupied.subarray(m.start, m.end).some(Boolean)) return;
                occupied.fill(1, m.start, m.end);
                accepted.push(m);
            });
            const anchors = accepted.filter(function (m) { return !m.kw.requiresContext; });
            accepted.forEach(function (m) {
                if (m.kw.requiresContext && !anchors.some(function (anchor) {
                    return Math.max(0, anchor.start - m.end, m.start - anchor.end) <= 150;
                })) return;
                const termKey = m.category + ':' + m.kw.normalized;
                const key = entry.block.source + ':' + termKey;
                if (!evidence.has(key)) evidence.set(key, {
                    term: m.kw.normalized, category: m.category, language: m.lang,
                    source: entry.block.source, requiresContext: m.kw.requiresContext, occurrences: 0
                });
                evidence.get(key).occurrences++;
            });
        });

        const candidates = Array.from(evidence.values());
        candidates.forEach(function (item) {
            item.points = (CATEGORY_WEIGHTS[item.category] + Math.min(item.occurrences - 1, 3)) * SOURCE_MULTIPLIERS[item.source];
        });
        candidates.sort(function (a, b) {
            return Number(a.requiresContext) - Number(b.requiresContext) || b.points - a.points ||
                (a.term + a.language + a.source).localeCompare(b.term + b.language + b.source);
        });
        const budgets = {};
        const selected = candidates.filter(function (item) {
            const key = item.source + ':' + item.language + ':' + item.category;
            budgets[key] = (budgets[key] || 0) + 1;
            return budgets[key] <= 5;
        });
        const terms = new Set(selected.map(function (item) { return item.category + ':' + item.term; }));
        const rawScore = selected.reduce(function (sum, item) { return sum + item.points; }, 0);
        const hasHeaderStrong = selected.some(function (item) {
            return item.category === 'strong' && !item.requiresContext && ['titleMeta', 'headings'].includes(item.source);
        });
        const distinctTerms = terms.size;
        let rule = 'insufficient_combination';
        if (selected.some(function (item) { return !item.requiresContext; })) {
            if (distinctTerms >= 5) rule = 'five_terms';
            else if (distinctTerms >= 4 && rawScore >= 40) rule = 'four_terms_40';
            else if (distinctTerms >= 3 && rawScore >= 50) rule = 'three_terms_50';
            else if (distinctTerms >= 2 && rawScore >= 70) rule = 'two_terms_70';
            else if (hasHeaderStrong && distinctTerms >= 2 && rawScore >= 40) rule = 'strong_header_40';
        }
        return {
            score: Math.round(rule === 'insufficient_combination' ? Math.min(rawScore, 23) : rawScore),
            rawScore: Math.round(rawScore * 100) / 100,
            rule: rule,
            scannerVersion: 2,
            keywordVersion: keywordDb.version,
            distinctTerms: distinctTerms,
            hasHeaderStrong: hasHeaderStrong,
            matchedLanguages: Array.from(new Set(selected.map(function (item) { return item.language; }))).sort(),
            matchedCategories: {
                strong: selected.filter(function (item) { return item.category === 'strong'; }).length,
                medium: selected.filter(function (item) { return item.category === 'medium'; }).length
            },
            topTerms: selected.slice().sort(function (a, b) { return b.points - a.points || a.term.localeCompare(b.term); })
                .slice(0, 8).map(function (item) {
                    return { term: item.term, source: item.source, points: item.points, occurrences: item.occurrences };
                })
        };
    }

    function isVisible(element) {
        if (!element) return true;
        // display:contents has visible descendants; aria-hidden is not visual hiding.
        for (let current = element; current; current = current.parentElement) {
            if (current.hidden) return false;
            const style = window.getComputedStyle(current);
            if (style.display === 'none' || style.contentVisibility === 'hidden' || style.opacity === '0') return false;
            if (current.tagName === 'DETAILS' && !current.open) {
                const summary = Array.from(current.children).find(function (child) { return child.tagName === 'SUMMARY'; });
                if (!summary || !summary.contains(element)) return false;
            }
        }
        const visibility = window.getComputedStyle(element).visibility;
        return visibility !== 'hidden' && visibility !== 'collapse';
    }

    function collectTextSources(root, includePageMetadata) {
        const blocks = [];
        if (includePageMetadata) {
            const metadata = [document.title, getMetaContent('description'), getMetaContent('keywords'),
                getMetaContent('og:title'), getMetaContent('og:description'), getMetaContent('twitter:title'), getMetaContent('twitter:description')];
            const unique = Array.from(new Set(metadata.map(normalizeText).filter(Boolean)));
            let remaining = 20000;
            unique.filter(function (text) {
                return !unique.some(function (other) { return other !== text && other.includes(text); });
            }).forEach(function (text) {
                blocks.push({ source: 'titleMeta', text: text.slice(0, remaining) });
                remaining = Math.max(0, remaining - text.length);
            });
            let path = location.pathname;
            try { path = decodeURIComponent(path); } catch (_) {}
            blocks.push({ source: 'path', text: path.slice(0, 5000) });
        }
        if (!root) return blocks;
        let previousOwner = null;
        let previousSource = null;
        let currentBlock = null;
        const visibility = new Map();
        const budgets = { body: MAX_TEXT_LENGTH, headings: 20000, linksButtons: 25000, navigation: 20000 };
        function add(element, text, attribute) {
            if (!text || element.closest('script, style, noscript, template')) return;
            if (root !== document.body && element.closest('shreddit-comment, .comment, [data-testid="comment"], aside, nav, footer')) return;
            if (!visibility.has(element)) visibility.set(element, isVisible(element));
            if (!visibility.get(element)) return;
            const navigation = element.closest('nav, footer, aside, [role="navigation"], [role="contentinfo"]');
            const heading = element.closest('h1, h2, h3');
            const link = element.closest('a, button');
            const source = navigation ? 'navigation' : attribute ? 'linksButtons' : heading ? 'headings' : link ? 'linksButtons' : 'body';
            if (budgets[source] <= 0) return;
            // Attributes are individual contexts, not neighbours of unrelated DOM text.
            const owner = attribute ? {} : element.closest('p, li, div, section, article, td, th, h1, h2, h3, pre, figcaption') || root;
            if (previousOwner !== owner || previousSource !== source) {
                currentBlock = { source: source, text: '' };
                blocks.push(currentBlock);
            }
            previousOwner = owner;
            previousSource = source;
            const part = (text + ' ').slice(0, budgets[source]);
            currentBlock.text += part;
            budgets[source] -= part.length;
        }
        // A shared DOM prefix bounds traversal. Each text node contributes to one zone only.
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let consumed = 0;
        let node;
        while (consumed < MAX_TEXT_LENGTH && (node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || parent.closest('script, style, noscript, template')) continue;
            const part = (node.nodeValue + ' ').slice(0, MAX_TEXT_LENGTH - consumed);
            consumed += part.length;
            add(parent, part.trimEnd(), false);
        }
        Array.from(root.querySelectorAll('a[title], button[title]')).slice(0, 300).forEach(function (element) {
            const title = element.getAttribute('title');
            if (normalizeText(title) !== normalizeText(element.textContent)) add(element, title, true);
        });
        Array.from(root.querySelectorAll('img[alt]')).slice(0, 50).forEach(function (element) {
            const alt = element.getAttribute('alt');
            if (alt.length > 2 && !/^(image|photo|picture|thumbnail|logo|icon|avatar|star|full star|half star|empty star|banner|pic|img)$/i.test(alt.trim())) add(element, alt, true);
        });
        return blocks;
    }

    function getMetaContent(nameOrProperty) {
        const element = document.head && document.head.querySelector('meta[name="' + nameOrProperty + '" i], meta[property="' + nameOrProperty + '" i]');
        return element ? element.getAttribute('content') || '' : '';
    }

    function normalizeText(text) {
        return String(text || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[\u0000-\u001f]+/g, ' ')
            .replace(/[\-_./]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(SFW_AESTHETIC_REGEX, '$1\uFFFC')
            .trim();
    }

    function escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function reportBlockedPage(result) {
        const root = document.documentElement;
        const previousDisplay = root ? root.style.display : '';
        if (document.documentElement) {
            document.documentElement.style.display = 'none';
        }
        document.querySelectorAll('video, audio').forEach(function (media) {
            try {
                media.pause();
            } catch (_) {}
        });

        function restorePage() {
            if (restoreBlockedPage !== restorePage) return;
            window.clearTimeout(recoveryTimer);
            restoreBlockedPage = null;
            if (root) {
                root.style.display = previousDisplay;
            }
            scanFinished = false;
        }

        // Also recover if the background never answers (for example during an update).
        const recoveryTimer = window.setTimeout(restorePage, 5000);
        restoreBlockedPage = restorePage;
        try {
            chrome.runtime.sendMessage({
                action: 'contentScanBlocked',
                url: location.href,
                hostname: location.hostname,
                score: result.score,
                matchedLanguages: result.matchedLanguages,
                matchedCategories: result.matchedCategories,
                diagnostics: { scannerVersion: result.scannerVersion, keywordVersion: result.keywordVersion,
                    rule: result.rule, rawScore: result.rawScore, distinctTerms: result.distinctTerms, topTerms: result.topTerms }
            }, function (response) {
                const error = chrome.runtime.lastError;
                if (restoreBlockedPage !== restorePage) return;
                window.clearTimeout(recoveryTimer);
                if (error || !response || !response.success) {
                    restorePage();
                }
            });
        } catch (_) {
            window.clearTimeout(recoveryTimer);
            restorePage();
        }
    }
}());
