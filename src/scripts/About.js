
document.addEventListener('DOMContentLoaded', async () => {
    hideExpiredOfferBanners();

    const data = await getDB();
    SetupDynamicDataFromDB(data.Sys_links);
    dataLoadFromBase(data.About);
    const localizedMessages = await loadPreferredLocaleMessages();
    localizeBounderlyOffer(localizedMessages);
	setTimeout(function() {loadOperaAlert(data.About.static.OperaAlert); }, 500);
});

function hideExpiredOfferBanners() {
    const today = new Date();

    document.querySelectorAll('[data-offer-hide-after]').forEach((banner) => {
        const [year, month, day] = banner.dataset.offerHideAfter.split('-').map(Number);
        const hideFrom = new Date(year, month - 1, day + 1);

        if (today >= hideFrom) {
            banner.hidden = true;
        }
    });
}

function localizeBounderlyOffer(messages) {
    const offerText = document.getElementById('bounderlyOfferText');
    const offerEnd = document.getElementById('bounderlyOfferEnd');

    if (offerText) {
        offerText.textContent = getLocalizedMessage(messages, 'bounderlyOfferText')
            || chrome.i18n.getMessage('bounderlyOfferText')
            || 'Use "FREE500" to get free premium!';
    }

    if (offerEnd) {
        offerEnd.textContent = getLocalizedMessage(messages, 'bounderlyOfferEnd')
            || chrome.i18n.getMessage('bounderlyOfferEnd')
            || 'Offer ends May 31.';
    }
}

function getLocalizedMessage(messages, key) {
    return messages && messages[key] && messages[key].message ? messages[key].message : '';
}

async function loadPreferredLocaleMessages() {
    try {
        const result = await new Promise((resolve) => {
            chrome.storage.local.get('sys_language', resolve);
        });
        const preferredLang = (result.sys_language || chrome.i18n.getUILanguage() || 'en').toLowerCase();
        const localeCandidates = buildLocaleCandidates(preferredLang);

        for (const locale of localeCandidates) {
            try {
                const response = await fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`));
                if (response.ok) {
                    return await response.json();
                }
            } catch (error) {
                /* try next locale */
            }
        }
    } catch (error) {
        /* fall back to chrome.i18n */
    }

    return null;
}

function buildLocaleCandidates(language) {
    const normalized = String(language || 'en').replace('_', '-').toLowerCase();
    const candidates = [];

    if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-hans') {
        candidates.push('zh-Hans', 'zh_CN');
    } else {
        candidates.push(normalized);

        const baseLanguage = normalized.split('-')[0];
        if (baseLanguage && baseLanguage !== normalized) {
            candidates.push(baseLanguage);
        }
    }

    candidates.push('en');
    return [...new Set(candidates)];
}

window.onload = async function () {
    document.getElementById('mainContainer').style.opacity = '1';
    
    // Main Tabs logic
    const mainTabs = document.querySelectorAll('.main-tab');
    const sections = document.querySelectorAll('.section-content');
    
    // Restore active main tab from sessionStorage
    const savedTab = sessionStorage.getItem('cm_active_tab');
    if (savedTab) {
        mainTabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        
        const activeTab = document.querySelector(`.main-tab[data-target="${savedTab}"]`);
        if (activeTab) activeTab.classList.add('active');
        
        const activeSection = document.getElementById(savedTab);
        if (activeSection) activeSection.classList.add('active');
    }
    
    mainTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            mainTabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            
            // Save state so reloads (language/theme change) don't reset the tab
            sessionStorage.setItem('cm_active_tab', targetId);
        });
    });

    const languageSelect = document.getElementById("languageSelect");
    
    // Move browser language to the top
    const browserLangFull = (navigator.language || navigator.userLanguage || chrome.i18n.getUILanguage() || 'en').toLowerCase();
    const browserLang = browserLangFull.split('-')[0];
    
    let targetOption = null;
    for (let i = 0; i < languageSelect.options.length; i++) {
        let optVal = languageSelect.options[i].value;
        if (optVal === browserLang || (browserLang === 'zh' && optVal === 'zh-Hans')) {
            targetOption = languageSelect.options[i];
            break;
        }
    }
    if (targetOption) {
        languageSelect.insertBefore(targetOption, languageSelect.options[0]);
    }

    chrome.storage.local.get("sys_language", function (result) {
        if (result.sys_language) {
            languageSelect.value = result.sys_language;
        } else {
            languageSelect.value = languageSelect.options[0].value;
        }
        updateFlag();
    });
    languageSelect.addEventListener("change", () => changeLanguage(languageSelect));
    //
    const themeSelect = document.getElementById("themeSelect");
    chrome.storage.local.get("sys_theme", function (result) {
        if (result.sys_theme) {
            themeSelect.value = result.sys_theme;
        }
    });
    themeSelect.addEventListener("change", () => changeTheme(themeSelect));

    const safeSearchToggle = document.getElementById('safeSearchToggle');
    chrome.storage.local.get('safeSearchEnabled', function (result) {
        safeSearchToggle.checked = result.safeSearchEnabled !== false;
    });
    safeSearchToggle.addEventListener('change', () => changeSafeSearchToggle(safeSearchToggle));

    const contentScanToggle = document.getElementById('contentScanToggle');
    chrome.storage.local.get('contentScanningEnabled', function (result) {
        contentScanToggle.checked = result.contentScanningEnabled !== false;
    });
    contentScanToggle.addEventListener('change', () => changeContentScanToggle(contentScanToggle));

    const domainPatternToggle = document.getElementById('domainPatternToggle');
    chrome.storage.local.get('domainPatternBlockingEnabled', function (result) {
        domainPatternToggle.checked = result.domainPatternBlockingEnabled !== false;
    });
    domainPatternToggle.addEventListener('change', () => changeDomainPatternToggle(domainPatternToggle));
    //
    [1, 2, 3].forEach((index) => {
        document.getElementById(`openTab${index}`).addEventListener('click', () => openTab(index));
        document.getElementById(`saveUserContentButton${index}`).addEventListener('click', () => saveUserContent(index));
        document.getElementById(`deleteUserContentButton${index}`).addEventListener('click', () => deleteUserContent(index));
        document.getElementById(`imageFile${index}`).addEventListener('change', () => previewImage(index));
    });
    //
    document.getElementById('exportBlocklistButton').addEventListener('click', exportBlocklist);
    document.getElementById('importBlocklistButton').addEventListener('click', importBlocklist);
    document.getElementById('addCustomDomainButton').addEventListener('click', addCustomDomainFromEditor);
    document.getElementById('customDomainInput').addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            addCustomDomainFromEditor();
        }
    });
    document.getElementById('blocklistSearchInput').addEventListener('input', renderCustomBlocklist);
    loadCustomBlocklistEditor();
    //
    loadUserContentFromStorage();
    
    // Restore inner tab state
    const savedSubTab = sessionStorage.getItem('cm_active_subtab') || 1;
    openTab(parseInt(savedSubTab));
};

async function getDB() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getData' }, (response) => {
            if (response) {
                resolve(response);
            } else {
                reject('Failed to load data');
            }
        });
    });
}

async function changeLanguage(languageSelect) {
    chrome.storage.local.set({ "sys_language": languageSelect.value }, function () {
        chrome.runtime.sendMessage({ action: 'loadData' }, (response) => {
            if (response.status === 'success') {
            } else {
                console.error('Error loading data:', response.message);
            }
        });
        //
        location.reload();
    });
}

async function changeTheme(themeSelected) {
    try {
        localStorage.setItem('cm_theme_cache', themeSelected.value);
    } catch (error) {
        /* no-op */
    }

    chrome.storage.local.set({ sys_theme: themeSelected.value }, () => {
        location.reload();
    });
}

async function changeSafeSearchToggle(toggle) {
    chrome.runtime.sendMessage({
        action: 'setSafeSearchEnabled',
        enabled: !!toggle.checked
    });
}

async function changeContentScanToggle(toggle) {
    chrome.storage.local.set({ contentScanningEnabled: !!toggle.checked });
}

async function changeDomainPatternToggle(toggle) {
    chrome.runtime.sendMessage({
        action: 'setDomainPatternBlockingEnabled',
        enabled: !!toggle.checked
    });
}

function updateFlag() {
    const selectedOption = languageSelect.options[languageSelect.selectedIndex];
    const flagUrl = selectedOption.getAttribute("data-flag");
    const flagImage = document.createElement("img");
    flagImage.src = flagUrl;
    flagImage.alt = selectedOption.text;
    const languageWrapper = languageSelect.parentNode;
    const existingFlag = languageWrapper.querySelector("img");
    if (existingFlag) {
        existingFlag.replaceWith(flagImage);
    } else {
        languageWrapper.insertBefore(flagImage, languageSelect);
    }
}

function SetupDynamicDataFromDB(Sys_links) {
    const link_support = Sys_links.support;
    const link_contact = Sys_links.contact;
    const link_source = Sys_links.source;
    document.getElementById('sourceButton').addEventListener('click', function () { openWebpage(link_source); });
    document.getElementById('contactButton').addEventListener('click', function () { openWebpage(link_contact); });
    document.getElementById('supportButton').addEventListener('click', function () { openWebpage(link_support); });
}

function openWebpage(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

function saveUserContent(index) {
    const fileInput = document.getElementById(`imageFile${index}`);
    const file = fileInput.files[0];
    const userText = document.getElementById(`userText${index}`).value;
    const maxSizeInBytes = 2 * 1024 * 1024;

    chrome.storage.local.get('userSlides', (result) => {
        const slides = result.userSlides || [{}, {}, {}]; // Initialize if undefined
        const currentSlide = slides[index - 1];

        if (file && file.size > maxSizeInBytes) {
            alert('Please, do not use image files above 2mb');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            const fileContent = event.target.result;
            slides[index - 1] = { text: userText, image: fileContent };
            chrome.storage.local.set({ userSlides: slides }, () => {
                console.log(`Slide ${index} saved to extension storage.`);
            });
        };

        if (file) {
            reader.readAsDataURL(file);
        } else {
            slides[index - 1] = { text: userText, image: currentSlide.image };
            chrome.storage.local.set({ userSlides: slides }, () => {
                console.log(`Slide ${index} saved to extension storage.`);
            });
        }
    });
}

function loadUserContentFromStorage() {
    chrome.storage.local.get('userSlides', (result) => {
        const slides = result.userSlides || [{}, {}, {}];
        slides.forEach((slide, index) => {
            if (slide) {
                document.getElementById(`userText${index + 1}`).value = slide.text || '';
                const imgElement = document.getElementById(`imagePreview${index + 1}`);
                imgElement.src = slide.image || '';
                imgElement.style.display = slide.image ? 'block' : 'none';
            }
        });
    });
}

function deleteUserContent(index) {
    chrome.storage.local.get('userSlides', (result) => {
        const slides = result.userSlides || [{}, {}, {}];
        slides[index - 1] = {}; // Clear the slide content
        chrome.storage.local.set({ userSlides: slides }, () => {
            console.log(`Slide ${index} deleted from storage.`);
            document.getElementById(`userText${index}`).value = '';
            const imgElement = document.getElementById(`imagePreview${index}`);
            imgElement.src = '';
            imgElement.style.display = 'none';
        });
    });
}

function openTab(tabIndex) {
    const sections = document.querySelectorAll('.user-input-section');
    // only get the inner tabs for the reminder section
    const tabs = document.querySelectorAll('.inner-tab-container .tab');
    sections.forEach((section, index) => {
        section.style.display = index + 1 === tabIndex ? 'block' : 'none';
        if (tabs[index]) {
            tabs[index].classList.toggle('active', index + 1 === tabIndex);
        }
    });
    sessionStorage.setItem('cm_active_subtab', tabIndex);
}

function previewImage(index) {
    const fileInput = document.getElementById(`imageFile${index}`);
    const preview = document.getElementById(`imagePreview${index}`);
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onloadend = function () {
        preview.src = reader.result;
        preview.style.display = 'block';
    };

    if (file) {
        reader.readAsDataURL(file);
    } else {
        preview.src = "";
        preview.style.display = 'none';
    }
}

function dataLoadFromBase(About) {
    const h1 = document.getElementById('h1text');
    const bannerText = document.getElementById('bannerText');
    const p1 = document.getElementById('p1');
    const p3 = document.getElementById('p3');
    const p4 = document.getElementById('p4');
    const sourceButton = document.getElementById('sourceButton').querySelector('span');
    const contactButton = document.getElementById('contactButton').querySelector('span');
    const supportButton = document.getElementById('supportButton').querySelector('span');
    const aboutTab = document.getElementById('aboutTab');
    const settingsTab = document.getElementById('settingsTab');
    const blocklistTab = document.getElementById('blocklistTab');
    const reminderTab = document.getElementById('reminderTab');
    const OwnPage = document.getElementById('OwnPage');
    const p5 = document.getElementById('p5');
    const openTab1 = document.getElementById('openTab1').querySelector('.tab-text');
    const openTab2 = document.getElementById('openTab2').querySelector('.tab-text');
    const openTab3 = document.getElementById('openTab3').querySelector('.tab-text');
    const deleteUserContentButton1 = document.getElementById('deleteUserContentButton1').querySelector('span');
    const saveUserContentButton1 = document.getElementById('saveUserContentButton1').querySelector('span');
    const deleteUserContentButton2 = document.getElementById('deleteUserContentButton2').querySelector('span');
    const saveUserContentButton2 = document.getElementById('saveUserContentButton2').querySelector('span');
    const deleteUserContentButton3 = document.getElementById('deleteUserContentButton3').querySelector('span');
    const saveUserContentButton3 = document.getElementById('saveUserContentButton3').querySelector('span');
    const languageSelectLabel = document.getElementById('languageSelectLabel');
    const themeSelectLabel = document.getElementById('themeSelectLabel');
    const themeLabelLight = document.getElementById('themeLabelLight');
    const themeLabelDark = document.getElementById('themeLabelDark');
	const safeSearchToggleLabel = document.getElementById('safeSearchToggleLabel');
	const safeSearchToggleHint = document.getElementById('safeSearchToggleHint');
    const contentScanToggleLabel = document.getElementById('contentScanToggleLabel');
    const contentScanToggleHint = document.getElementById('contentScanToggleHint');
	const exportBlocklistButton = document.getElementById('exportBlocklistButton').querySelector('span');
	const importBlocklistButton = document.getElementById('importBlocklistButton').querySelector('span');
    const addCustomDomainButtonText = document.getElementById('addCustomDomainButtonText');
    const customDomainInput = document.getElementById('customDomainInput');
    const blocklistSearchInput = document.getElementById('blocklistSearchInput');
    const customBlocklistEmpty = document.getElementById('customBlocklistEmpty');
    const blocklistEmptyText = document.getElementById('blocklistEmptyText');
    const blocklistHeaderTitle = document.getElementById('blocklistHeaderTitle');
    const blocklistHeaderHint = document.getElementById('blocklistHeaderHint');
    const domainPatternToggleLabel = document.getElementById('domainPatternToggleLabel');
    const domainPatternToggleHint = document.getElementById('domainPatternToggleHint');

    const bannerTexts = {
    en: 'Check out our new project!',
    es: '¡Descubre nuestro nuevo proyecto!',
    fr: 'Découvrez notre nouveau projet !',
    de: 'Schau dir unser neues Projekt an!',
    ru: 'Посмотрите наш новый проект!',
    hi: 'हमारा नया प्रोजेक्ट देखें!',
    it: 'Scopri il nostro nuovo progetto!',
    ja: '新しいプロジェクトをご覧ください！',
    ko: '새 프로젝트를 확인해 보세요!',
    pl: 'Sprawdź nasz nowy projekt!',
    pt: 'Confira nosso novo projeto!',
    tr: 'Yeni projemize göz atın!',
    'zh-Hans': '看看我们的新项目！'
    };

    h1.textContent = About.static.h1;
    setSafeHTML(p1, About.static.p1);
    p3.textContent = About.static.p3;
    p4.textContent = About.static.p4;
    sourceButton.textContent = About.static.sourceButton;
    contactButton.textContent = About.static.contactButton;
    supportButton.textContent = About.static.supportButton;
    aboutTab.textContent = About.static.aboutTab || 'About';
    settingsTab.textContent = About.static.settingsTab || 'Settings';
    blocklistTab.textContent = About.static.blocklistTab || 'Custom blocklist';
    reminderTab.textContent = About.static.reminderTab || 'Reminder';
    OwnPage.textContent = About.static.OwnPage;
    p5.textContent = About.static.p5;
    openTab1.textContent = About.static.openTab1 || 'Option (1)';
    openTab2.textContent = About.static.openTab2 || 'Option (2)';
    openTab3.textContent = About.static.openTab3 || 'Option (3)';
    deleteUserContentButton1.textContent = About.static.deleteUserContentButton;
    customBlocklistDeleteText = About.static.deleteUserContentButton || 'Delete';
    saveUserContentButton1.textContent = About.static.saveUserContentButton;
    deleteUserContentButton2.textContent = About.static.deleteUserContentButton;
    saveUserContentButton2.textContent = About.static.saveUserContentButton;
    deleteUserContentButton3.textContent = About.static.deleteUserContentButton;
    saveUserContentButton3.textContent = About.static.saveUserContentButton;
    // Strip "1111" from preferred language bug if it exists in data
    let langLabel = About.static.languageSelectLabel || 'Preferred language:';
    if(langLabel.startsWith('1111')) langLabel = langLabel.substring(4);
    languageSelectLabel.textContent = langLabel;
    
    themeSelectLabel.textContent = About.static.themeSelectLabel;
    themeLabelLight.textContent = About.static.themeLabelLight;
    themeLabelDark.textContent = About.static.themeLabelDark;
	safeSearchToggleLabel.textContent = About.static.safeSearchToggleLabel || 'Safe search protection';
	safeSearchToggleHint.textContent = About.static.safeSearchToggleHint || 'Forces safe search on supported search engines when possible.';
    contentScanToggleLabel.textContent = About.static.contentScanToggleLabel || 'Content scan blocking';
    contentScanToggleHint.textContent = About.static.contentScanToggleHint || 'Blocks pages by page-content tags, not just domain rules.';
	exportBlocklistButton.textContent = About.static.exportBlocklistButton;
	importBlocklistButton.textContent = About.static.importBlocklistButton;
    addCustomDomainButtonText.textContent = About.static.addDomainBtn || 'Add';
    customDomainInput.placeholder = About.static.domainInput || 'domain.com or https://domain.com/page';
    blocklistSearchInput.placeholder = About.static.blocklistSearchInput || 'Search domains...';
    customBlocklistEmpty.dataset.emptyText = About.static.customBlocklistEmpty || 'No custom domains yet.';
    customBlocklistEmpty.dataset.searchEmptyText = About.static.customBlocklistSearchEmpty || 'No matching domains.';
    if (blocklistEmptyText) blocklistEmptyText.textContent = customBlocklistEmpty.dataset.emptyText;
    if (blocklistHeaderTitle) blocklistHeaderTitle.textContent = About.static.blocklistHeaderTitle || 'Custom Blocklist';
    if (blocklistHeaderHint) blocklistHeaderHint.textContent = About.static.blocklistHeaderHint || 'Add domains or URLs you want to block';
    domainPatternToggleLabel.textContent = About.static.domainPatternToggleLabel || 'Domain pattern blocking';
    domainPatternToggleHint.textContent = About.static.domainPatternToggleHint || 'Blocks high-confidence domain patterns (rule34* and .xxx domains).';

    chrome.storage.local.get('sys_language', function (result) {
        const lang = (result.sys_language || chrome.i18n.getUILanguage() || document.documentElement.lang || 'en').toLowerCase();
        setMultilineText(bannerText, bannerTexts[lang] || bannerTexts[lang.split('-')[0]] || bannerTexts.en);
    });
}

function setMultilineText(element, value) {
    const lines = String(value).split(/\r?\n/);
    element.textContent = '';

    lines.forEach((line, index) => {
        if (index > 0) {
            element.appendChild(document.createElement('br'));
        }

        element.appendChild(document.createTextNode(line));
    });
}

function loadOperaAlert(Message) {
	const urlParams = new URLSearchParams(window.location.search);
    let isNewInstall = urlParams.get('isNewInstall') === 'true' && !localStorage.getItem('alertShown');
    
    // Only show alert if it's Opera AND a new installation
    if (isNewInstall && (navigator.userAgent.indexOf("OPR") > -1 || navigator.userAgent.indexOf("Opera") > -1)) {
        alert(Message);
        
        // Set isNewInstall to false within the current function call
        isNewInstall = false;
        
        // Store a flag to indicate that the alert has been shown
        localStorage.setItem('alertShown', 'true');
    }
}

let customBlocklistDomains = [];
let blocklistStatusTimer = null;
let customBlocklistDeleteText = 'Delete';

function loadCustomBlocklistEditor() {
    chrome.storage.local.get('customBlockedDomains', function (result) {
        customBlocklistDomains = Array.isArray(result.customBlockedDomains)
            ? result.customBlockedDomains.slice().sort((a, b) => a.localeCompare(b))
            : [];
        renderCustomBlocklist();
    });
}

function renderCustomBlocklist() {
    const list = document.getElementById('customBlocklistList');
    const empty = document.getElementById('customBlocklistEmpty');
    const count = document.getElementById('blocklistCount');
    const searchInput = document.getElementById('blocklistSearchInput');

    if (!list || !empty || !count || !searchInput) {
        return;
    }

    const query = searchInput.value.trim().toLowerCase();
    const filteredDomains = customBlocklistDomains.filter(domain => domain.toLowerCase().includes(query));

    list.textContent = '';
    filteredDomains.forEach(domain => {
        const item = document.createElement('div');
        item.className = 'blocklist-item';

        const domainText = document.createElement('span');
        domainText.className = 'blocklist-domain';
        domainText.textContent = domain;

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'blocklist-remove-btn';
        const removeIcon = document.createElement('i');
        removeIcon.className = 'fas fa-trash';
        const removeLabel = document.createElement('span');
        removeLabel.textContent = customBlocklistDeleteText;
        removeButton.appendChild(removeIcon);
        removeButton.appendChild(removeLabel);
        removeButton.addEventListener('click', () => deleteCustomDomainFromEditor(domain));

        item.appendChild(domainText);
        item.appendChild(removeButton);
        list.appendChild(item);
    });

    const totalText = customBlocklistDomains.length === 1 ? '1 domain' : `${customBlocklistDomains.length} domains`;
    count.textContent = query
        ? `${filteredDomains.length} / ${totalText}`
        : totalText;
    const emptyTextEl = empty.querySelector('.blocklist-empty-text') || empty;
    emptyTextEl.textContent = query
        ? (empty.dataset.searchEmptyText || 'No matching domains.')
        : (empty.dataset.emptyText || 'No custom domains yet.');
    empty.style.display = filteredDomains.length === 0 ? '' : 'none';
}

function setBlocklistStatus(message, isError) {
    const status = document.getElementById('blocklistStatus');
    if (!status) {
        return;
    }

    status.textContent = message || '';
    status.style.color = isError ? '#e74c3c' : '';

    clearTimeout(blocklistStatusTimer);
    if (message) {
        blocklistStatusTimer = setTimeout(() => {
            status.textContent = '';
            status.style.color = '';
        }, 3500);
    }
}

function addCustomDomainFromEditor() {
    const input = document.getElementById('customDomainInput');
    if (!input) {
        return;
    }

    const domain = input.value.trim();
    if (!domain) {
        setBlocklistStatus('Enter a domain first.', true);
        return;
    }

    chrome.runtime.sendMessage({ action: 'addDomain', domain: domain, silent: true }, function (response) {
        if (response && response.success) {
            input.value = '';
            setBlocklistStatus(response.message || 'Domain added.');
            loadCustomBlocklistEditor();
        } else {
            setBlocklistStatus((response && response.error) || 'Failed to add domain.', true);
        }
    });
}

function deleteCustomDomainFromEditor(domain) {
    chrome.runtime.sendMessage({ action: 'deleteDomain', domain: domain, silent: true }, function (response) {
        if (response && response.success) {
            setBlocklistStatus(response.message || 'Domain removed.');
            loadCustomBlocklistEditor();
        } else {
            setBlocklistStatus((response && response.error) || 'Failed to remove domain.', true);
        }
    });
}

// Function to export blocklist
async function exportBlocklist() {
    chrome.storage.local.get('customBlockedDomains', function(result) {
        let domains = result.customBlockedDomains || [];
        let formatString = "# Format: domainName.domainZone, e.g. site.com, 1 per line.";
        let text = formatString + '\n' + domains.join('\n');
        let filename = "customBlockedDomains.txt";
        let blob = new Blob([text], { type: 'text/plain' });
        let downloadLink = URL.createObjectURL(blob);

        let a = document.createElement('a');
        a.href = downloadLink;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadLink);
    });
}

// Function to import blocklist
async function importBlocklist() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt'; // Accept only .txt files

    input.onchange = async function(event) {
        const file = event.target.files[0];

        if (!file) {
            alert("No file selected.");
            console.log("No file selected.");
            return;
        }

        if (file.type && file.type !== 'text/plain' && !file.name.toLowerCase().endsWith('.txt')) {
            alert("Please select a .txt file.");
            return;
        }

        const reader = new FileReader();

        reader.onload = async function(event) {
            const fileContent = event.target.result;
            const lines = fileContent.split('\n');
            const domainsToAdd = [];

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine && !trimmedLine.startsWith('#')) { // Ignore empty lines and comments
                    domainsToAdd.push(trimmedLine);
                }
            }

            if (domainsToAdd.length === 0) {
                alert("No domains to add found in the file.");
                return;
            }

            if (domainsToAdd.length > 4900) {
                alert("Import limit exceeded.\n\nDue to technical limitations, you can import a maximum of 4900 custom blocks.\n\nPlease reduce the number of entries in your file and try again.");
                return; // Stop import if limit exceeded
            }

            let importSuccess = true; // Flag to track overall import success
            let importErrors = [];
            let successfulImports = 0;

            for (const domain of domainsToAdd) {
                await new Promise(resolve => { // Use promise to wait for each sendMessage response
                    chrome.runtime.sendMessage({ action: "addDomain", domain: domain, silent: true }, function (response) {
                        if (response && response.success) {
                            console.log(`Domain "${domain}" added successfully: ${response.message}`);
                            successfulImports++;
                        } else {
                            importSuccess = false;
                            let errorMessage = `Domain "${domain}": `;
                            if (response && response.error) {
                                errorMessage += `${response.error}`;
                                if (response.message) { // Include "type" text if available
                                    errorMessage += ` (Type: ${response.message})`;
                                }
                            } else {
                                errorMessage += 'Unknown error';
                            }
                            importErrors.push(errorMessage);
                            console.log(`Error adding domain "${domain}": ${response ? response.error : 'Unknown error'}`, response);
                        }
                        resolve(); // Resolve promise to move to the next domain
                    });
                });
            }

            let message = "";
            if (importSuccess) {
                message = `Successfully imported ${successfulImports} domains.`;
            } else {
                message = `Import completed with errors.\n\n`;
                message += `Successfully imported ${successfulImports} out of ${domainsToAdd.length} domains.\n\n`;
                if (importErrors.length > 0) {
                    message += `Errors encountered:\n`;
                    importErrors.forEach(error => {
                        message += `- ${error}\n`;
                    });
                    console.log("Import errors:", importErrors.join("\n")); // Log detailed errors in console
                } else {
                    message += `Unknown errors during import.`; // In case importSuccess is false but no errors are collected.
                }
            }
            alert(message);
            loadCustomBlocklistEditor();
        };

        reader.onerror = function(event) {
            alert("Error reading the file.");
            console.log("Error reading file:", event);
        };

        reader.readAsText(file);
    };

    input.click(); // Programmatically open file selection dialog
}
