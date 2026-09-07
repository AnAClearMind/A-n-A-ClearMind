initializeDomains().then(updateRules).then(loadData);

let customBlockedDomains = [];
let domainRuleIds = {};
let jsonData;
const DOMAIN_PATTERN_RULES = [
    {
        idSuffix: 9002,
        blockedLabel: 'rule34 pattern',
        regexFilter: '^https?:\/\/[^\/]*rule34[^\/]*(?::\d+)?(?:[\/?#]|$)'
    },
    {
        idSuffix: 9003,
        blockedLabel: 'r34 pattern',
        regexFilter: '^https?:\/\/[^\/]*r34[^\/]*(?::\d+)?(?:[\/?#]|$)'
    },
    {
        idSuffix: 9004,
        blockedLabel: '.xxx domain',
        regexFilter: '^https?:\/\/[^\/]+\.xxx(?::\d+)?(?:[\/?#]|$)'
    },
    {
        idSuffix: 9005,
        blockedLabel: '.porn domain',
        regexFilter: '^https?:\/\/[^\/]+\.porn(?::\d+)?(?:[\/?#]|$)'
    },
    {
        idSuffix: 9006,
        blockedLabel: 'hentai pattern',
        regexFilter: '^https?:\/\/[^\/]*hentai[^\/]*(?::\d+)?(?:[\/?#]|$)'
    },
    {
        idSuffix: 9007,
        blockedLabel: 'bdsm pattern',
        regexFilter: '^https?:\/\/[^\/]*bdsm[^\/]*(?::\d+)?(?:[\/?#]|$)'
    }
];
const SAFE_SEARCH_CONFIGS = [
    { id: 8001, domains: ['google.com'], param: 'safe', value: 'active' },
    { id: 8002, domains: ['bing.com'], param: 'adlt', value: 'strict' },
    { id: 8003, domains: ['duckduckgo.com'], param: 'kp', value: '1' },
    { id: 8004, domains: ['yahoo.com'], param: 'vm', value: 'r' },
    { id: 8005, domains: ['ya.ru', 'yandex.ru', 'yandex.com'], param: 'family', value: 'yes' },
    { id: 8006, domains: ['brave.com', 'search.brave.com'], param: 'safesearch', value: 'strict' },
    { id: 8007, domains: ['qwant.com'], param: 's', value: '2' },
    { id: 8008, domains: ['mojeek.com'], param: 'safe', value: '1' }
];

chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason == "install") {
        const supportedLanguages = ['en', 'es', 'fr', 'de', 'ru', 'hi', 'it', 'ja', 'ko', 'pl', 'pt', 'tr', 'zh-Hans'];
        let browserLanguage = chrome.i18n.getUILanguage();
        if (browserLanguage === 'zh-CN' || browserLanguage === 'zh-TW') {
            browserLanguage = 'zh-Hans';
        } else {
            browserLanguage = browserLanguage.split('-')[0];
        }
        const languageToSet = supportedLanguages.includes(browserLanguage) ? browserLanguage : 'en';
        chrome.storage.local.set({ sys_language: languageToSet });

        // First install => initialize data in storage
        chrome.storage.local.set({ lastInstalled: Date.now() });
        chrome.storage.local.set({ progress: 0 });
        console.log('Extension installed');

        // Add isNewInstall parameter to the URL
        chrome.tabs.create({ url: chrome.runtime.getURL("pages/About.html?isNewInstall=true") });

        chrome.storage.local.set({ SlidesDataVar_Informational: 0 });
        chrome.storage.local.set({ SlidesDataVar_MessageToYourself: 0 });
        chrome.storage.local.set({ SlidesDataVar_Quote: 0 });
        chrome.storage.local.set({ SlidesDataVar_Video: 0 });
        chrome.storage.local.set({ SlidesDataVar_SimpleAction: 0 });
        chrome.storage.local.set({ SlidesDataVar_PictureSelection: [] });
        chrome.storage.local.set({ SlidesDataVar_REWARDS: 0 });
        chrome.storage.local.set({ safeSearchEnabled: true });
        chrome.storage.local.set({ contentScanningEnabled: true });
        chrome.storage.local.set({ domainPatternBlockingEnabled: true });
        chrome.storage.local.set({ contentScanAllowedDomains: [] });
        chrome.storage.local.set({ contentScanDetections: [] });

    } else if (details.reason == "update") {
        console.log('Extension updated (or restarted by browser after changed global settings).');
        chrome.storage.local.set({ lastStartedWithBrowser: Date.now() });

        const currentVersion = chrome.runtime.getManifest().version;
        if (currentVersion === '2.0' && details.previousVersion !== '2.0') {
            chrome.tabs.create({ url: chrome.runtime.getURL("pages/WhatsNew.html") });
        }
    }
});

// on browser start
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.set({ lastStartedWithBrowser: Date.now() });
    chrome.storage.local.set({ cycleInSessionCounter: 0 });
});

// Function to load domains from JSON file
async function loadDomainsFromFile(filename) {
    try {
        const response = await fetch(chrome.runtime.getURL(filename));
        const json = await response.json();
        return json.domains || [];
    } catch (error) {
        console.error(`Error loading domains from ${filename}:`, error);
        return [];
    }
}

// Handle messages from extension pages.
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (!request || !request.action) {
        return false;
    }

    if (request.action === "contentScanBlocked") {
        handleContentScanBlocked(request, sender, sendResponse);
        return true;
    }

    if (request.action === 'getContentScanningEnabled') {
        chrome.storage.local.get('contentScanningEnabled', function (result) {
            sendResponse({ enabled: result.contentScanningEnabled !== false });
        });
        return true;
    }

    if (request.action === 'setDomainPatternBlockingEnabled') {
        chrome.storage.local.set({ domainPatternBlockingEnabled: request.enabled !== false }, function () {
            updateRules().then(function (success) {
                if (success) {
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: 'Failed to update blocking rules' });
                }
            });
        });
        return true;
    }

    if (request.action === 'setSafeSearchEnabled') {
        chrome.storage.local.set({ safeSearchEnabled: request.enabled !== false }, function () {
            updateRules().then(function (success) {
                if (success) {
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: 'Failed to update rules' });
                }
            });
        });
        return true;
    }

    if (request.action === "addDomain") {
        const domain = normalizeDomain(request.domain);
        if (!domain) {
            sendResponse({ success: false, error: chrome.i18n.getMessage("invalidDomainFormat") });
            return false;
        }

        if (domain.includes('google')) {
            sendResponse({ success: false, error: chrome.i18n.getMessage("blockingGoogleNotAvailable") });
            return false;
        }

        if (customBlockedDomains.includes(domain)) {
            sendResponse({ success: false, error: chrome.i18n.getMessage("domainAlreadyInBlocklist") });
            return false;
        }

        const candidateList = [...customBlockedDomains, domain];
        updateRulesAtomic(candidateList).then(res => {
            if (res.success) {
                customBlockedDomains = candidateList;
                saveCustomDomains();
                if (request.silent) {
                    sendResponse({ success: true, message: chrome.i18n.getMessage("domainAddedSuccessfully"), domain: domain });
                } else {
                    setTimeout(() => {
                        reloadActiveTab();
                        sendResponse({ success: true, message: chrome.i18n.getMessage("domainAddedSuccessfully"), domain: domain });
                    }, 100);
                }
            } else {
                sendResponse({ success: false, error: res.error || chrome.i18n.getMessage("failedToUpdateBlockingRules") });
            }
        });
        return true;
    }

    if (request.action === "deleteDomain") {
        const domain = normalizeDomain(request.domain) || (typeof request.domain === 'string' ? request.domain.toLowerCase().trim() : '');
        if (!domain) {
            sendResponse({ success: false, error: chrome.i18n.getMessage("invalidDomainFormat") });
            return false;
        }

        const index = customBlockedDomains.indexOf(domain);
        if (index !== -1) {
            const candidateList = customBlockedDomains.filter(d => d !== domain);
            updateRulesAtomic(candidateList).then(res => {
                if (res.success) {
                    customBlockedDomains = candidateList;
                    saveCustomDomains();
                    if (request.silent) {
                        sendResponse({ success: true, message: chrome.i18n.getMessage("domainRemovedSuccessfully"), domain: domain });
                    } else {
                        setTimeout(() => {
                            reloadActiveTab(domain);
                            sendResponse({ success: true, message: chrome.i18n.getMessage("domainRemovedSuccessfully"), domain: domain });
                        }, 100);
                    }
                } else {
                    sendResponse({ success: false, error: res.error || chrome.i18n.getMessage("failedToUpdateBlockingRules") });
                }
            });
            return true;
        } else {
            sendResponse({ success: false, error: "Domain not in blocklist" });
            return false;
        }
    }

    if (request.action === "importDomains") {
        if (!Array.isArray(request.domains)) {
            sendResponse({ success: false, error: "Invalid payload: domains must be an array" });
            return true;
        }

        let addedCount = 0;
        let duplicateCount = 0;
        let invalidCount = 0;

        const existingSet = new Set(customBlockedDomains);
        const newDomainsToAdd = [];

        request.domains.forEach(rawDomain => {
            const normalized = normalizeDomain(rawDomain);
            if (!normalized || normalized.includes('google')) {
                invalidCount++;
                return;
            }

            if (existingSet.has(normalized)) {
                duplicateCount++;
            } else {
                existingSet.add(normalized);
                newDomainsToAdd.push(normalized);
                addedCount++;
            }
        });

        if (newDomainsToAdd.length === 0) {
            sendResponse({
                success: true,
                added: 0,
                duplicates: duplicateCount,
                invalid: invalidCount
            });
            return true;
        }

        const candidateList = [...customBlockedDomains, ...newDomainsToAdd];

        updateRulesAtomic(candidateList).then(result => {
            if (result.success) {
                customBlockedDomains = candidateList;
                saveCustomDomains();
                sendResponse({
                    success: true,
                    added: addedCount,
                    duplicates: duplicateCount,
                    invalid: invalidCount
                });
            } else {
                sendResponse({
                    success: false,
                    error: result.error
                });
            }
        });

        return true;
    }

    if (request.action === 'loadData') {
        loadData().then(() => {
            if (jsonData) {
                sendResponse({ status: 'success', data: jsonData });
            } else {
                sendResponse({ status: 'error', message: 'Failed to load localization data' });
            }
        }).catch(error => {
            sendResponse({ status: 'error', message: error.message });
        });
        return true;
    }

    if (request.action === 'getData') {
        if (!jsonData) {
            loadData().then(() => {
                sendResponse(jsonData);
            }).catch(error => {
                sendResponse({ status: 'error', message: error.message });
            });
            return true;
        } else {
            sendResponse(jsonData);
        }
        return false;
    }

    return false;
});

// Load blocked domains when the extension starts
async function initializeDomains() {
    const result = await chrome.storage.local.get('customBlockedDomains');
    customBlockedDomains = result.customBlockedDomains || [];
    console.log('Custom blocked domains loaded:', customBlockedDomains);

    chrome.storage.local.get(['domainPatternBlockingEnabled'], function (settings) {
        if (typeof settings.domainPatternBlockingEnabled === 'undefined') {
            chrome.storage.local.set({ domainPatternBlockingEnabled: true });
        }
    });

    chrome.storage.local.get(['safeSearchEnabled'], function (settings) {
        if (typeof settings.safeSearchEnabled === 'undefined') {
            chrome.storage.local.set({ safeSearchEnabled: true });
        }
    });

    //
    chrome.storage.local.set({ lastInitializedBackworker: Date.now() });
}

// Function to reload the active tab
function reloadActiveTab(unblockedDomain) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
            if (unblockedDomain) {
                const url = `https://${unblockedDomain}`;
                chrome.tabs.update(tabs[0].id, { url: url });
            } else {
                chrome.tabs.reload(tabs[0].id);
            }
        }
    });
}


function getRedirectUrl(blockedUrl, isSubFrame) {
    const encodedUrl = encodeURIComponent(new URL(blockedUrl).hostname);
    return chrome.runtime.getURL(`../pages/UrgeTest_initial.html?blocked=${encodedUrl}`);
}

function getPatternRedirectUrl(blockedLabel) {
    return chrome.runtime.getURL(`../pages/UrgeTest_initial.html?blocked=${encodeURIComponent(blockedLabel)}`);
}

function handleContentScanBlocked(request, sender, sendResponse) {
    if (!sender || !sender.tab || typeof sender.tab.id !== 'number') {
        sendResponse({ success: false, error: 'No sender tab available' });
        return;
    }

    const hostname = normalizeScannedHostname(request.hostname || request.url);
    if (!hostname) {
        sendResponse({ success: false, error: 'Invalid scanned hostname' });
        return;
    }

    saveContentScanDetection({
        hostname: hostname,
        timestamp: Date.now(),
        score: Number(request.score) || 0,
        matchedLanguages: Array.isArray(request.matchedLanguages) ? request.matchedLanguages : [],
        matchedCategories: request.matchedCategories || {}
    });

    chrome.tabs.update(sender.tab.id, {
        url: chrome.runtime.getURL(`../pages/UrgeTest_initial.html?blocked=${encodeURIComponent(hostname)}`)
    }, function () {
        if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
        }
            sendResponse({ success: true });
    });
}

function normalizeDomain(input) {
    if (typeof input !== 'string') return null;
    let trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;

    try {
        if (trimmed.includes('://')) {
            const parsed = new URL(trimmed);
            trimmed = parsed.hostname;
        }
    } catch (e) {
        // Continue with raw trimmed string if URL parsing fails
    }

    if (trimmed.startsWith('www.')) {
        trimmed = trimmed.substring(4);
    }

    const domainPattern = /^[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!domainPattern.test(trimmed)) {
        return null;
    }

    return trimmed;
}

function normalizeScannedHostname(value) {
    try {
        const url = new URL(value.includes('://') ? value : 'https://' + value);
        return (url.protocol === 'http:' || url.protocol === 'https:') ? url.hostname : '';
    } catch (_) {
        return '';
    }
}

function saveContentScanDetection(detection) {
    chrome.storage.local.get('contentScanDetections', function (result) {
        const detections = Array.isArray(result.contentScanDetections) ? result.contentScanDetections : [];
        detections.unshift(detection);
        chrome.storage.local.set({ contentScanDetections: detections.slice(0, 50) });
    });
}

async function updateRulesAtomic(targetCustomDomains) {
    try {
        const activeCustomDomains = targetCustomDomains !== undefined ? targetCustomDomains : customBlockedDomains;
        const settings = await chrome.storage.local.get(['domainPatternBlockingEnabled', 'safeSearchEnabled']);
        const domainPatternBlockingEnabled = settings.domainPatternBlockingEnabled !== false;
        const safeSearchEnabled = settings.safeSearchEnabled !== false;
        const allDomains = activeCustomDomains;

        const rules = allDomains.flatMap((domain, index) => {
            const frameRuleId = (index * 2) + 1;
            const blockRuleId = (index * 2) + 2;
            domainRuleIds[domain] = frameRuleId;

            return [
                {
                    id: frameRuleId,
                    priority: 1,
                    action: {
                        type: 'redirect',
                        redirect: {
                            url: getRedirectUrl(`https://${domain}`)
                        }
                    },
                    condition: {
                        urlFilter: `||${domain}^`,
                        resourceTypes: ['main_frame', 'sub_frame']
                    }
                },
                {
                    id: blockRuleId,
                    priority: 1,
                    action: {
                        type: 'block'
                    },
                    condition: {
                        urlFilter: `||${domain}^`,
                        resourceTypes: ['image', 'media', 'script', 'object', 'websocket']
                    }
                }
            ];
        });

        if (domainPatternBlockingEnabled) {
            DOMAIN_PATTERN_RULES.forEach(function (patternRule) {
                rules.push({
                    id: allDomains.length * 2 + patternRule.idSuffix,
                    priority: 1,
                    action: {
                        type: 'redirect',
                        redirect: {
                            url: getPatternRedirectUrl(patternRule.blockedLabel)
                        }
                    },
                    condition: {
                        regexFilter: patternRule.regexFilter,
                        resourceTypes: ['main_frame', 'sub_frame']
                    }
                });
            });
        }

        if (safeSearchEnabled) {
            SAFE_SEARCH_CONFIGS.forEach((config, index) => {
                rules.push({
                    id: allDomains.length * 2 + 8000 + index,
                    priority: 1,
                    action: {
                        type: 'redirect',
                        redirect: {
                            transform: {
                                queryTransform: {
                                    addOrReplaceParams: [
                                        { key: config.param, value: config.value }
                                    ]
                                }
                            }
                        }
                    },
                    condition: {
                        requestDomains: config.domains,
                        resourceTypes: ['main_frame', 'sub_frame']
                    }
                });
            });
        }

        const dnr = chrome.declarativeNetRequest;
        const dynamicLimit = dnr.MAX_NUMBER_OF_DYNAMIC_RULES || dnr.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES || 5000;
        const unsafeLimit = dnr.MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES || dynamicLimit;
        // Reserve protection rules even when disabled so toggles can always be enabled again.
        const protectionRuleCount = DOMAIN_PATTERN_RULES.length + SAFE_SEARCH_CONFIGS.length;
        const domainLimit = Math.max(0, Math.min(Math.floor((dynamicLimit - protectionRuleCount) / 2),
            unsafeLimit - protectionRuleCount));
        if (allDomains.length > domainLimit) {
            return { success: false, error: chrome.i18n.getMessage("customBlocklistLimitReached", String(domainLimit)) };
        }

        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRuleIds = existingRules.map(rule => rule.id);

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: rules
        });

        console.log('Dynamic DNR rules updated atomically:', rules.length);
        return { success: true };
    } catch (error) {
        console.error('Error updating dynamic DNR rules atomically:', error);
        return { success: false, error: error.message || 'DNR Rule update failed' };
    }
}

// Function to save custom domains to storage
function saveCustomDomains() {
    chrome.storage.local.set({ customBlockedDomains: customBlockedDomains }, function () {
        console.log('Custom domains saved:', customBlockedDomains);
    });
}

async function updateRules() {
    const res = await updateRulesAtomic();
    return res.success;
}

async function loadData() {
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'ru', 'hi', 'it', 'ja', 'ko', 'pl', 'pt', 'tr', 'zh-Hans'];
    let lang = 'en';

    try {
        const storedLang = await new Promise(resolve => {
            chrome.storage.local.get('sys_language', result => {
                resolve(result && result.sys_language);
            });
        });

        if (storedLang && supportedLanguages.includes(storedLang)) {
            lang = storedLang;
        }
    } catch (e) {
        console.warn('ClearMind: Error reading sys_language, fallback to en', e);
    }

    try {
        const primaryUrl = chrome.runtime.getURL(`DB/${lang}-DB.json`);
        const response = await fetch(primaryUrl);
        if (!response.ok) {
            throw new Error(`Failed to load ${lang}-DB.json, status: ${response.status}`);
        }
        jsonData = await response.json();
        console.log(`ClearMind: Loaded DB for locale '${lang}'`);
    } catch (primaryErr) {
        console.warn(`ClearMind: Primary DB load failed for '${lang}', attempting fallback to 'en-DB.json'`, primaryErr);
        try {
            const fallbackUrl = chrome.runtime.getURL('DB/en-DB.json');
            const fallbackResponse = await fetch(fallbackUrl);
            if (!fallbackResponse.ok) {
                throw new Error(`Fallback en-DB.json load failed, status: ${fallbackResponse.status}`);
            }
            jsonData = await fallbackResponse.json();
            console.log("ClearMind: Loaded fallback 'en-DB.json'");
        } catch (fallbackErr) {
            console.error("ClearMind: Critical error — failed to load both primary and fallback localization DBs", fallbackErr);
        }
    }
}

chrome.runtime.onInstalled.addListener(() => {
    const title = chrome.i18n.getMessage("contextMenuTitle");
    chrome.contextMenus.create({
        id: "myContextMenu",
        title: title,
        contexts: ["page"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "myContextMenu") {
        chrome.tabs.create({ url: chrome.runtime.getURL("../pages/UrgeTest_initial.html?blocked=via alert button") });
    }
});
