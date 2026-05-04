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
        chrome.runtime.sendMessage({ action: 'getContentScanningEnabled' }, function (toggleResponse) {
            chrome.storage.local.get(['contentScanAllowedDomains'], function (result) {
                callback({
                    enabled: toggleResponse ? toggleResponse.enabled !== false : true,
                    allowedDomains: Array.isArray(result.contentScanAllowedDomains) ? result.contentScanAllowedDomains : []
                });
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
            return response.json();
        }).then(function (db) {
            const langs = db.languages || {};
            Object.keys(langs).forEach(function (langCode) {
                const lang = langs[langCode];
                ['strong', 'medium'].forEach(function (category) {
                    const keywords = Array.isArray(lang[category]) ? lang[category] : [];
                    lang[category] = keywords.map(function (kw) {
                        const normalized = normalizeText(kw);
                        const escaped = escapeRegex(normalized).replace(/\s+/g, '\\s+');
                        return {
                            original: kw,
                            regex: new RegExp('(^|[^\\p{L}\\p{N}])(' + escaped + ')([^\\p{L}\\p{N}]|$)', 'iu')
                        };
                    });
                });
            });
            return db;
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
        const summary = {
            score: 0,
            matchedLanguages: {},
            matchedCategories: {
                strong: 0,
                medium: 0
            },
            matchedTerms: {}
        };

        Object.keys(sources).forEach(function (sourceName) {
            const normalizedText = normalizeText(sources[sourceName]);
            if (!normalizedText) {
                return;
            }

            scoreTextSource(normalizedText, SOURCE_MULTIPLIERS[sourceName] || 1, summary);
        });

        if (!hasBlockingCombination(summary)) {
            summary.score = Math.min(summary.score, RESCAN_THRESHOLD - 1);
        }

        summary.score = Math.round(summary.score);
        summary.matchedLanguages = Object.keys(summary.matchedLanguages);
        delete summary.matchedTerms;
        return summary;
    }

    function hasBlockingCombination(summary) {
        const distinctTerms = Object.keys(summary.matchedTerms).length;

        return distinctTerms >= 5 || (distinctTerms >= 2 && summary.score >= BLOCK_THRESHOLD * 2);
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
        const headingText = getElementsText('h1, h2, h3');
        const linkButtonText = getElementsText('a, button');
        const bodyText = getBodyTextFast();

        return {
            titleMeta: limitText([document.title, metaDescription, metaKeywords].join(' '), 20000),
            headings: limitText(headingText, 20000),
            linksButtons: limitText(linkButtonText, 20000),
            body: limitText(bodyText, MAX_TEXT_LENGTH),
            path: limitText(decodeURIComponent(location.pathname || ''), 5000)
        };
    }

    function getMetaContent(name) {
        const element = document.querySelector('meta[name="' + name + '" i]');
        return element ? element.getAttribute('content') || '' : '';
    }

    function getElementsText(selector) {
        return Array.prototype.map.call(document.querySelectorAll(selector), function (element) {
            return element.innerText || element.textContent || '';
        }).join(' ');
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

    function scoreTextSource(text, sourceMultiplier, summary) {
        const languages = keywordDb.languages || {};
        const matchedKeywords = {};

        Object.keys(languages).forEach(function (languageCode) {
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
                        summary.score += CATEGORY_WEIGHTS[category] * sourceMultiplier;
                        summary.matchedLanguages[languageCode] = true;
                        summary.matchedCategories[category] += 1;
                        summary.matchedTerms[matchKey] = true;
                    }
                });
            });
        });
    }

    function escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function reportBlockedPage(result) {
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
