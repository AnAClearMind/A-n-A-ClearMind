initializeDomains().then(updateRules).then(loadData); // any start of background.js

let blockedDomains = [];
let customBlockedDomains = [];
let domainRuleIds = {};
let jsonData;

chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason == "install") {
        const supportedLanguages = ['en', 'es', 'fr', 'de', 'ru'];
        const browserLanguage = chrome.i18n.getUILanguage().split('-')[0];
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

    } else if (details.reason == "update") {
        console.log('Extension updated (or restarted by browser after changed global settigns).');
        chrome.storage.local.set({ lastStartedWithBrowser: Date.now() });
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

// Handle messages from popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "addDomain") {
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
            return;
        }

        // Check if the domain is a simple word like "youtube"
        if (!domain.includes('.')) {
            sendResponse({ success: false, error: chrome.i18n.getMessage("invalidDomainFormat") });
            return;
        }

        // Specific check for 'google'
        if (domain.includes('google')) {
            sendResponse({ success: false, error: chrome.i18n.getMessage("blockingGoogleNotAvailable") });
            return;
        }

        if (customBlockedDomains.length >= 100) {
            sendResponse({ success: false, error: chrome.i18n.getMessage("customBlocklistLimitReached") });
            return;
        }

        if (!customBlockedDomains.includes(domain)) {
            customBlockedDomains.push(domain);
            saveCustomDomains();
            updateRules().then(success => {
                if (success) {
                    // Delay the reload to ensure rules are applied
                    setTimeout(() => {
                        console.log('Trigger page reload', domain);
                        reloadActiveTab();
                        sendResponse({ success: true, message: chrome.i18n.getMessage("domainAddedSuccessfully") });
                    }, 100); // 100ms delay, adjust if needed
                } else {
                    sendResponse({ success: false, error: chrome.i18n.getMessage("failedToUpdateBlockingRules") });
                }
            });
            console.log('Domain added to custom blocklist:', domain);
        } else {
            sendResponse({ success: false, error: chrome.i18n.getMessage("domainAlreadyInBlocklist") });
        }
    } else if (request.action === "deleteDomain") {
        let domain = request.domain.toLowerCase();
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
                    // Delay the reload to ensure rules are applied
                    setTimeout(() => {
                        console.log('Trigger page reload', domain);
                        reloadActiveTab(domain);
                        sendResponse({ success: true, message: chrome.i18n.getMessage("domainRemovedSuccessfully") });
                    }, 100); // 100ms delay, adjust if needed
                } else {
                    sendResponse({ success: false, error: chrome.i18n.getMessage("failedToUpdateBlockingRules") });
                }
            });
            console.log('Domain removed from custom blocklist:', domain);
        } else {
            if (blockedDomains.includes(domain)) {
                sendResponse({ success: false, error: chrome.i18n.getMessage("domainNotBlockedByUserRule") });
            } else {
                sendResponse({ success: false, error: chrome.i18n.getMessage("domainNotFoundInCustomBlocklist") });
            }
        }
    }
    return true; // Keeps the message channel open for the async response
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'loadData') {
        loadData().then(() => {
            sendResponse({ status: 'success', data: jsonData });
        }).catch(error => {
            sendResponse({ status: 'error', message: error.message });
        });
        return true;
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getData') {
        if (!jsonData) {
            loadData().then(() => {
                sendResponse(jsonData);
            });
        } else {
            sendResponse(jsonData);
        }
        return true;
    }
});

// Load blocked domains when the extension starts
async function initializeDomains() {
    const [domains, result] = await Promise.all([
        loadDomainsFromFile('../DB/blocklist.json'),
        chrome.storage.local.get('customBlockedDomains')
    ]);
    blockedDomains = domains;
    customBlockedDomains = result.customBlockedDomains || [];
    console.log('Blocked domains loaded:', blockedDomains);
    console.log('Custom blocked domains loaded:', customBlockedDomains);
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

async function setupBlockingRules() {
    const allDomains = blockedDomains.concat(customBlockedDomains);
    const rules = allDomains.flatMap((domain, index) => {
        const baseRuleId = (index + 1);
        domainRuleIds[domain] = baseRuleId;
        const regexPattern = `^https?://([a-z0-9-]+\\.)*${domain}/`;
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
                    regexFilter: regexPattern,
                    resourceTypes: ['main_frame', 'sub_frame', 'image', 'media', 'script', 'object', 'websocket']
                }
            }
        ];
    });

    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: Object.values(domainRuleIds).flatMap(id => [id, id + 1, id + 2]),
            addRules: rules
        });
        console.log('Blocking rules updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating blocking rules:', error);
        return false;
    }
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