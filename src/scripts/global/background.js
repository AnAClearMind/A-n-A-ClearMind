initializeDomains().then(updateRules).then(loadData);

let blockedDomains = [];
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
        chrome.tabs.create({ url: "../pages/About.html?isNewInstall=true" });

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
            chrome.tabs.create({ url: "../pages/WhatsNew.html" });
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
        if (typeof request.domain !== 'string') {
            sendResponse({ success: false, error: chrome.i18n.getMessage("invalidDomainFormat") });
            return false;
        }

        let domain = request.domain.toLowerCase();

        // Check if the input is a URL and extract the domain
        try {
            const url = new URL(domain);
            domain = url.hostname;
        } catch (e) {
            // Not a valid URL, continue with domain as is
        }

        // Strip "www." if present
        if (domain.startsWith("www.")) {
            domain = domain.substring(4);
        }

        // Validate the domain format
        const domainPattern = /^[a-z0-9.-]+\.[a-z]{2,}$/;
        if (!domainPattern.test(domain)) {
            sendResponse({ success: false, error: chrome.i18n.getMessage("invalidDomainFormat") });
            return false;
        }

        // Check if the domain is a simple word like "youtube"
        if (!domain.includes('.')) {
            sendResponse({ success: false, error: chrome.i18n.getMessage("invalidDomainFormat") });
            return false;
        }

        // Specific check for 'google'
        if (domain.includes('google')) {
            sendResponse({ success: false, error: chrome.i18n.getMessage("blockingGoogleNotAvailable") });
            return false;
        }

        if (customBlockedDomains.length >= 4900) {
            sendResponse({ success: false, error: chrome.i18n.getMessage("customBlocklistLimitReached") });
            return false;
        }

        if (!customBlockedDomains.includes(domain)) {
            customBlockedDomains.push(domain);
            saveCustomDomains();
            updateRules().then(success => {
                if (success) {
                    if (request.silent) {
                        sendResponse({ success: true, message: chrome.i18n.getMessage("domainAddedSuccessfully"), domain: domain });
                    } else {
                        // Delay the reload to ensure rules are applied
                        setTimeout(() => {
                            console.log('Trigger page reload', domain);
                            reloadActiveTab();
                            sendResponse({ success: true, message: chrome.i18n.getMessage("domainAddedSuccessfully"), domain: domain });
                        }, 100); // 100ms delay, adjust if needed
                    }
                } else {
                    sendResponse({ success: false, error: chrome.i18n.getMessage("failedToUpdateBlockingRules") });
                }
            });
            console.log('Domain added to custom blocklist:', domain);
            return true;
        } else {
            sendResponse({ success: false, error: chrome.i18n.getMessage("domainAlreadyInBlocklist") });
        }

        return false;
    }

    if (request.action === "deleteDomain") {
        if (typeof request.domain !== 'string') {
            sendResponse({ success: false, error: chrome.i18n.getMessage("invalidDomainFormat") });
            return false;
        }

        let domain = request.domain.toLowerCase();
        try {
            const url = new URL(domain);
            domain = url.hostname;
        } catch (e) {
            // Not a valid URL, continue with domain as is
        }

        // Strip "www." if present
        if (domain.startsWith("www.")) {
            domain = domain.substring(4);
        }
        const index = customBlockedDomains.indexOf(domain);
        if (index !== -1) {
            customBlockedDomains.splice(index, 1);
            saveCustomDomains();
            updateRules().then(success => {
                if (success) {
                    if (request.silent) {
                        sendResponse({ success: true, message: chrome.i18n.getMessage("domainRemovedSuccessfully"), domain: domain });
                    } else {
                        // Delay the reload to ensure rules are applied
                        setTimeout(() => {
                            console.log('Trigger page reload', domain);
                            reloadActiveTab(domain);
                            sendResponse({ success: true, message: chrome.i18n.getMessage("domainRemovedSuccessfully"), domain: domain });
                        }, 100); // 100ms delay, adjust if needed
                    }
                } else {
                    sendResponse({ success: false, error: chrome.i18n.getMessage("failedToUpdateBlockingRules") });
                }
            });
            console.log('Domain removed from custom blocklist:', domain);
            return true;
        } else {
            if (blockedDomains.includes(domain)) {
                sendResponse({ success: false, error: chrome.i18n.getMessage("domainNotBlockedByUserRule") });
            } else {
                sendResponse({ success: false, error: chrome.i18n.getMessage("domainNotFoundInCustomBlocklist") });
            }
        }

        return false;
    }

    if (request.action === 'loadData') {
        loadData().then(() => {
            sendResponse({ status: 'success', data: jsonData });
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
    blockedDomains = [];
    customBlockedDomains = result.customBlockedDomains || [];
    console.log('Blocked domains loaded:', blockedDomains);
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
    chrome.storage.local.get(['lastInitializedBackworker', 'lastStartedWithBrowser'], function (data) {
        if (data.lastInitializedBackworker - data.lastStartedWithBrowser > 60000) {
            console.log('Extension was manually restarted by user. Resetting progress');
            chrome.storage.local.set({ progress: 0 });
        }
    });
}

// Function to reload the active tab
function reloadActiveTab(unblockedDomain) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
            if (unblockedDomain) {
                const url = `http://${unblockedDomain}`;
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

function normalizeScannedHostname(value) {
    if (typeof value !== 'string') {
        return '';
    }

    let hostname = value.toLowerCase().trim();
    try {
        hostname = new URL(hostname).hostname;
    } catch (e) {
        // Continue with the provided hostname if it was not a full URL.
    }

    hostname = hostname.replace(/^www\./, '');
    const domainPattern = /^[a-z0-9.-]+\.[a-z]{2,}$/;
    return domainPattern.test(hostname) ? hostname : '';
}

function saveContentScanDetection(detection) {
    chrome.storage.local.get('contentScanDetections', function (result) {
        const detections = Array.isArray(result.contentScanDetections) ? result.contentScanDetections : [];
        detections.unshift(detection);
        chrome.storage.local.set({ contentScanDetections: detections.slice(0, 50) });
    });
}

async function setupBlockingRules() {
    const settings = await chrome.storage.local.get(['domainPatternBlockingEnabled', 'safeSearchEnabled']);
    const domainPatternBlockingEnabled = settings.domainPatternBlockingEnabled !== false;
    const safeSearchEnabled = settings.safeSearchEnabled !== false;
    const allDomains = blockedDomains.concat(customBlockedDomains);
    const rules = allDomains.flatMap((domain, index) => {
        const baseRuleId = (index + 1);
        domainRuleIds[domain] = baseRuleId;

        return [
            {
                id: baseRuleId,
                priority: 1,
                action: {
                    type: 'redirect',
                    redirect: {
                        url: getRedirectUrl(`http://${domain}`)
                    }
                },
                condition: {
                    urlFilter: `||${domain}^`,
                    resourceTypes: ['main_frame', 'sub_frame', 'image', 'media', 'script', 'object', 'websocket']
                }
            }
        ];
    });

    if (domainPatternBlockingEnabled) {
        DOMAIN_PATTERN_RULES.forEach(function (patternRule) {
            rules.push({
                id: allDomains.length + patternRule.idSuffix,
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

        SAFE_SEARCH_CONFIGS.forEach((config, index) => {
            rules.push({
                id: allDomains.length + 8000 + index,
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

    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: rules
        });
        console.log('Blocking rules updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating blocking rules:', error);
        return false;
    }
}

function escapeRegexForDnr(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Function to save custom domains to storage
function saveCustomDomains() {
    chrome.storage.local.set({ customBlockedDomains: customBlockedDomains }, function () {
        console.log('Custom domains saved:', customBlockedDomains);
    });
}


async function resetRules() {
    try {
        const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
        const ruleIdsToRemove = currentRules.map(rule => rule.id);

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ruleIdsToRemove
        });

        domainRuleIds = {};
        console.log('All rules have been reset');
    } catch (error) {
        console.error('Error resetting rules:', error);
    }
}

async function updateRules() {
    try {
        await resetRules();
        await setupBlockingRules();
        console.log('Rules have been updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating rules:', error);
        return false;
    }
}

async function loadData() {
    try {
        const language = await new Promise((resolve, reject) => {
            chrome.storage.local.get('sys_language', (result) => {
                if (result.sys_language) {
                    resolve(result.sys_language); // resolve with the language value
                } else {
                    reject('Language not found in storage');
                }
            });
        });
        const response = await fetch(chrome.runtime.getURL(`../DB/${language}-DB.json`));
        jsonData = await response.json();
    } catch (error) {
        console.error('Error loading JSON:', error);
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
