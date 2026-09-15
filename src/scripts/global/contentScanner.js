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
        'reddit.com',
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
        path: 0.5
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
            const compiledDb = { languages: {} };
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
            attributeFilter: ['alt', 'title', 'content', 'lang']
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
        const sources = collectTextSources();
        const pageLang = (document.documentElement && document.documentElement.lang ? document.documentElement.lang.toLowerCase() : '');
        const summary = {
            score: 0,
            hasHeaderStrong: false,
            matchedLanguages: {},
            matchedCategories: {
                strong: 0,
                medium: 0
            },
            matchedTerms: {},
            headerStrongTerms: {},
            languageTermCounts: {},
            matchedLanguageTerms: {},
            potentialForeignShortMatches: []
        };

        Object.keys(sources).forEach(function (sourceName) {
            const normalizedText = normalizeText(sources[sourceName]);
            if (!normalizedText) {
                return;
            }

            scoreTextSource(normalizedText, SOURCE_MULTIPLIERS[sourceName] || 1, summary, sourceName);
        });

        // Prune isolated short foreign Latin terms on non-matching language pages to prevent false positives
        summary.potentialForeignShortMatches.forEach(function (item) {
            if (!pageLang.startsWith(item.lang) && (summary.languageTermCounts[item.lang] || 0) < 2) {
                summary.score -= item.points;
                summary.matchedCategories[item.category] -= 1;
                delete summary.matchedTerms[item.termKey];
                delete summary.headerStrongTerms[item.termKey];
                if (summary.languageTermCounts[item.lang] <= 1) {
                    delete summary.matchedLanguages[item.lang];
                }
            }
        });
        summary.hasHeaderStrong = Object.keys(summary.headerStrongTerms).length > 0;

        if (!hasBlockingCombination(summary)) {
            summary.score = Math.min(summary.score, RESCAN_THRESHOLD - 1);
        }

        summary.score = Math.round(summary.score);
        summary.matchedLanguages = Object.keys(summary.matchedLanguages);
        delete summary.matchedTerms;
        delete summary.headerStrongTerms;
        delete summary.matchedLanguageTerms;
        delete summary.languageTermCounts;
        delete summary.potentialForeignShortMatches;
        return summary;
    }

    function hasBlockingCombination(summary) {
        // Ambiguous vocabulary can support other evidence, but cannot establish it alone.
        if (!Object.values(summary.matchedTerms).some(Boolean)) {
            return false;
        }
        const distinctTerms = Object.keys(summary.matchedTerms).length;
        const score = summary.score;

        if (distinctTerms >= 5) {
            return true;
        }
        if (distinctTerms >= 4 && score >= BLOCK_THRESHOLD) {
            return true;
        }
        if (distinctTerms >= 3 && score >= 50) {
            return true;
        }
        if (distinctTerms >= 2 && score >= 70) {
            return true;
        }
        if (summary.hasHeaderStrong && distinctTerms >= 2 && score >= BLOCK_THRESHOLD) {
            return true;
        }
        return false;
    }

    function getBodyTextFast() {
        if (!document.body) return '';
        let text = '';
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: function(node) {
                const tag = node.parentNode ? node.parentNode.nodeName : '';
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let currentNode;
        while (currentNode = walker.nextNode()) {
            text += currentNode.nodeValue + ' ';
        }
        return text;
    }

    function collectTextSources() {
        const metaDescription = getMetaContent('description');
        const metaKeywords = getMetaContent('keywords');
        const ogTitle = getMetaContent('og:title');
        const ogDescription = getMetaContent('og:description');
        const twitterTitle = getMetaContent('twitter:title');
        const twitterDescription = getMetaContent('twitter:description');
        const allTitleMeta = [
            document.title,
            metaDescription,
            metaKeywords,
            ogTitle,
            ogDescription,
            twitterTitle,
            twitterDescription
        ].filter(Boolean).map(normalizeText);
        // Social metadata commonly repeats the title/description verbatim.
        const uniqueTitleMeta = Array.from(new Set(allTitleMeta)).join(' ');

        const headingText = getElementsText('h1, h2, h3');
        const linkButtonText = getLinksAndButtonsText() + ' ' + getImageAltText();
        const bodyText = getBodyTextFast();

        let safePath = location.pathname || '';
        try {
            safePath = decodeURIComponent(safePath);
        } catch (e) {
            console.warn('ClearMind: Failed to decode URI path in content scanner', e);
        }

        return {
            titleMeta: limitText(uniqueTitleMeta, 20000),
            headings: limitText(headingText, 20000),
            linksButtons: limitText(linkButtonText, 25000),
            body: limitText(bodyText, MAX_TEXT_LENGTH),
            path: limitText(safePath, 5000)
        };
    }

    function getMetaContent(nameOrProperty) {
        const element = document.querySelector('meta[name="' + nameOrProperty + '" i], meta[property="' + nameOrProperty + '" i]');
        return element ? element.getAttribute('content') || '' : '';
    }

    function getElementsText(selector) {
        return Array.prototype.map.call(document.querySelectorAll(selector), function (element) {
            return element.textContent || '';
        }).join(' ');
    }

    function getLinksAndButtonsText() {
        const elements = document.querySelectorAll('a, button');
        const parts = [];
        const maxElements = Math.min(elements.length, 300);
        for (let i = 0; i < maxElements; i++) {
            const el = elements[i];
            const text = el.textContent;
            if (text) {
                parts.push(text);
            }
            const title = el.getAttribute('title');
            if (title && title !== text) {
                parts.push(title);
            }
        }
        return parts.join(' ');
    }

    function getImageAltText() {
        const images = document.images || document.querySelectorAll('img');
        const parts = [];
        const maxImages = Math.min(images.length, 50);
        const genericAlts = /^(image|photo|picture|thumbnail|logo|icon|avatar|star|full star|half star|empty star|banner|pic|img)$/i;
        for (let i = 0; i < maxImages; i++) {
            const alt = images[i].getAttribute('alt');
            if (alt && alt.length > 2 && !genericAlts.test(alt.trim())) {
                parts.push(alt);
            }
        }
        return parts.join(' ');
    }

    function limitText(text, maxLength) {
        return String(text || '').slice(0, maxLength);
    }

    function normalizeText(text) {
        return String(text || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[\u0000-\u001f]+/g, ' ')
            .replace(/[\-_./]+/g, ' ')
            .replace(/\s+/g, ' ')
            // Keep a separator token so removal cannot manufacture a keyword phrase.
            .replace(SFW_AESTHETIC_REGEX, '$1\uFFFC')
            .trim();
    }

    function scoreTextSource(text, sourceMultiplier, summary, sourceName) {
        const languages = keywordDb.languages || {};
        const matchedKeywords = {};

        Object.keys(languages).forEach(function (languageCode) {
            const filter = SCRIPT_FILTERS[languageCode];
            if (filter && !filter.test(text)) {
                return;
            }

            const language = languages[languageCode];

            Object.keys(CATEGORY_WEIGHTS).forEach(function (category) {
                const keywordObjs = Array.isArray(language[category]) ? language[category] : [];
                let categoryMatches = 0;

                keywordObjs.forEach(function (kwObj) {
                    if (categoryMatches >= 5) {
                        return;
                    }

                    const matchKey = category + ':' + kwObj.original;
                    if (matchedKeywords[matchKey]) {
                        return;
                    }

                    if (kwObj.regex.test(text)) {
                        matchedKeywords[matchKey] = true;
                        categoryMatches += 1;

                        const matchCount = (text.match(kwObj.globalRegex) || []).length;
                        const extraMatches = Math.min(Math.max(0, matchCount - 1), 3);
                        const repeatBonus = extraMatches * 1;
                        const pointsAdded = (CATEGORY_WEIGHTS[category] + repeatBonus) * sourceMultiplier;

                        summary.score += pointsAdded;
                        summary.matchedLanguages[languageCode] = true;
                        summary.matchedCategories[category] += 1;
                        summary.matchedTerms[matchKey] = !kwObj.requiresContext;

                        const langTermKey = languageCode + ':' + kwObj.original;
                        if (!summary.matchedLanguageTerms[langTermKey]) {
                            summary.matchedLanguageTerms[langTermKey] = true;
                            summary.languageTermCounts[languageCode] = (summary.languageTermCounts[languageCode] || 0) + 1;
                        }

                        if (category === 'strong' && !kwObj.requiresContext && (sourceName === 'titleMeta' || sourceName === 'headings')) {
                            summary.headerStrongTerms[matchKey] = true;
                        }

                        if (kwObj.isLatinShortForeign) {
                            summary.potentialForeignShortMatches.push({
                                lang: languageCode,
                                termKey: matchKey,
                                points: pointsAdded,
                                category: category
                            });
                        }
                    }
                });
            });
        });
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
                matchedCategories: result.matchedCategories
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
