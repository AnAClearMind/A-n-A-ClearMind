(function () {
    const KEYWORD_DB_PATH = 'DB/adult-keywords.json';
    const BLOCK_THRESHOLD = 40;
    const RESCAN_THRESHOLD = 24;
    const MAX_TEXT_LENGTH = 100000;
    const MAX_RESCANS = 3;
    const RESCAN_DELAY_MS = 1500;
    const MUTATION_DEBOUNCE_MS = 1500;
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
        'reddit.com',
        'news.google.com',
        'news.ycombinator.com'
    ];
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

    if (!shouldScanCurrentPage()) {
        return;
    }

    getScannerSettings(function (settings) {
        if (!settings.enabled || isAllowedDomain(location.hostname, settings.allowedDomains)) {
            return;
        }

        loadKeywordDb().then(function (db) {
            keywordDb = db;
            runScanWithRescan();
            observeDynamicContent();
        }).catch(function (error) {
            console.warn('ClearMind content scanner could not load keyword DB:', error);
        });
    });

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
                            isLatinShortForeign: isLatinShortForeign,
                            regex: isCjk
                                ? new RegExp(escaped, 'iu')
                                : new RegExp('(^|[^\\p{L}\\p{N}])(' + escaped + ')([^\\p{L}\\p{N}]|$)', 'iu'),
                            globalRegex: isCjk
                                ? new RegExp(escaped, 'giu')
                                : new RegExp('(^|[^\\p{L}\\p{N}])(' + escaped + ')(?=[^\\p{L}\\p{N}]|$)', 'giu')
                        };
                    });
                });
            });
            return compiledDb;
        });
    }

    function runScanWithRescan() {
        if (scanFinished || !keywordDb) {
            return;
        }

        scanCount += 1;
        const result = scanPage();

        if (result.score >= BLOCK_THRESHOLD) {
            scanFinished = true;
            window.clearTimeout(mutationTimer);
            reportBlockedPage(result);
            return;
        }

        if (result.score >= RESCAN_THRESHOLD && scanCount < MAX_RESCANS) {
            window.setTimeout(runScanWithRescan, RESCAN_DELAY_MS);
        }
    }

    function observeDynamicContent() {
        if (!document.body || scanFinished) {
            return;
        }

        const observer = new MutationObserver(function () {
            if (scanFinished || scanCount >= MAX_RESCANS) {
                observer.disconnect();
                return;
            }

            window.clearTimeout(mutationTimer);
            mutationTimer = window.setTimeout(runScanWithRescan, MUTATION_DEBOUNCE_MS);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
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
                if (summary.languageTermCounts[item.lang] <= 1) {
                    delete summary.matchedLanguages[item.lang];
                }
            }
        });

        if (!hasBlockingCombination(summary)) {
            summary.score = Math.min(summary.score, RESCAN_THRESHOLD - 1);
        }

        summary.score = Math.round(summary.score);
        summary.matchedLanguages = Object.keys(summary.matchedLanguages);
        delete summary.matchedTerms;
        delete summary.matchedLanguageTerms;
        delete summary.languageTermCounts;
        delete summary.potentialForeignShortMatches;
        return summary;
    }

    function hasBlockingCombination(summary) {
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
        ].filter(Boolean).join(' ');

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
            titleMeta: limitText(allTitleMeta, 20000),
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
                        summary.matchedTerms[matchKey] = true;

                        const langTermKey = languageCode + ':' + kwObj.original;
                        if (!summary.matchedLanguageTerms[langTermKey]) {
                            summary.matchedLanguageTerms[langTermKey] = true;
                            summary.languageTermCounts[languageCode] = (summary.languageTermCounts[languageCode] || 0) + 1;
                        }

                        if (category === 'strong' && (sourceName === 'titleMeta' || sourceName === 'headings')) {
                            summary.hasHeaderStrong = true;
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
        if (document.documentElement) {
            document.documentElement.style.display = 'none';
        }
        document.querySelectorAll('video, audio').forEach(function (media) {
            try {
                media.pause();
            } catch (_) {}
        });

        chrome.runtime.sendMessage({
            action: 'contentScanBlocked',
            url: location.href,
            hostname: location.hostname,
            score: result.score,
            matchedLanguages: result.matchedLanguages,
            matchedCategories: result.matchedCategories
        });
    }
}());
