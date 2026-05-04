document.addEventListener('DOMContentLoaded', async () => {
    // Fade in the container (consistent with other pages)
    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) {
        requestAnimationFrame(() => {
            mainContainer.style.opacity = '1';
        });
    }

    const localizedMessages = await loadPreferredLocaleMessages();

    // Localize document title
    document.title = getLocalizedMessage(localizedMessages, 'whatsNewTitle') || chrome.i18n.getMessage('whatsNewTitle') || "What's New";

    // Localize elements
    const elementsToLocalize = [
        { id: 'whatsNewTitle',        messageName: 'whatsNewTitle' },
        { id: 'whatsNewIntro',        messageName: 'whatsNewIntro' },
        { id: 'whatsNewPerformanceText',  messageName: 'whatsNewPerformance' },
        { id: 'whatsNewProtectionText',   messageName: 'whatsNewProtection' },
        { id: 'whatsNewLocalizationText', messageName: 'whatsNewLocalization' },
        { id: 'bounderlyCaption',     messageName: 'bounderlyCaption' },
    ];

    elementsToLocalize.forEach(({ id, messageName }) => {
        const element = document.getElementById(id);
        if (element) {
            const translated = getLocalizedMessage(localizedMessages, messageName) || chrome.i18n.getMessage(messageName);
            if (translated) {
                if (id === 'bounderlyCaption') {
                    setMultilineText(element, translated);
                } else {
                    element.textContent = translated;
                }
            }
        }
    });

    const lightBanner = document.querySelector('.banner-light');
    const darkBanner = document.querySelector('.banner-dark');

    const syncBannerVisibility = () => {
        const isDarkTheme = document.documentElement.classList.contains('dark-theme')
            || document.body?.classList.contains('dark-theme')
            || document.documentElement.dataset.theme === 'dark'
            || document.body?.dataset?.theme === 'dark';

        if (lightBanner) {
            lightBanner.hidden = isDarkTheme;
            lightBanner.setAttribute('aria-hidden', String(isDarkTheme));
        }

        if (darkBanner) {
            darkBanner.hidden = !isDarkTheme;
            darkBanner.setAttribute('aria-hidden', String(!isDarkTheme));
        }
    };

    syncBannerVisibility();

    const themeObserver = new MutationObserver(syncBannerVisibility);
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
    });

    if (document.body) {
        themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['class', 'data-theme'],
        });
    }

    // Handle continue button
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
        const continueText = getLocalizedMessage(localizedMessages, 'continue_btn')
            || chrome.i18n.getMessage('continue_btn')
            || chrome.i18n.getMessage('ok')
            || 'Continue';
        // Update only the text span, preserve the icon
        const span = continueBtn.querySelector('span');
        if (span) {
            span.textContent = continueText;
        } else {
            continueBtn.textContent = continueText;
        }

        continueBtn.addEventListener('click', () => {
            window.close();
        });
    }
});

function getLocalizedMessage(messages, key) {
    return messages && messages[key] && messages[key].message ? messages[key].message : '';
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
        /* fallback to chrome.i18n */
    }

    return null;
}

function buildLocaleCandidates(language) {
    const normalized = language.replace('_', '-');
    const baseLang = normalized.split('-')[0];
    const candidates = [normalized];

    if (normalized === 'zh-hans') {
        candidates.push('zh-Hans', 'zh_CN');
    }

    if (normalized === 'zh-cn') {
        candidates.push('zh_CN', 'zh-Hans');
    }

    if (!candidates.includes(baseLang)) {
        candidates.push(baseLang);
    }

    if (!candidates.includes('en')) {
        candidates.push('en');
    }

    return candidates;
}
