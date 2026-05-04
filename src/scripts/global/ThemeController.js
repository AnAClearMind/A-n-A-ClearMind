applyInitialTheme();
initSystemThemeListener();

function applyInitialTheme() {
    const cachedTheme = getCachedTheme();
    if (cachedTheme) {
        setTheme(cachedTheme);
    }

    checkSysTheme().catch(() => {});
}

function initSystemThemeListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = (e) => {
        const systemTheme = e.matches ? 'dark' : 'light';
        setTheme(systemTheme);
        // Sync with storage so other components know the current theme
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ sys_theme: systemTheme });
        }
    };

    // Listen for changes
    mediaQuery.addEventListener('change', handleThemeChange);
}

function getCachedTheme() {
    try {
        const storageTheme = localStorage.getItem('cm_theme_cache');
        if (storageTheme === 'dark' || storageTheme === 'light') {
            return storageTheme;
        }
    } catch (error) {
        /* no-op */
    }

    const rootTheme = document.documentElement.dataset.theme;
    if (rootTheme === 'dark' || rootTheme === 'light') {
        return rootTheme;
    }

    const bodyTheme = document.body?.dataset?.theme;
    if (bodyTheme === 'dark' || bodyTheme === 'light') {
        return bodyTheme;
    }

    return '';
}

async function checkSysTheme() {
    try {
        const sysTheme = await getSysTheme();
        if (sysTheme) {
            setTheme(sysTheme);
        } else if (!getCachedTheme()) {
            setTheme('light');
        }
    } catch (error) {
        if (!getCachedTheme()) {
            setTheme('light');
        }
    }
}

async function getSysTheme() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['sys_theme'], (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result.sys_theme);
            }
        });
    });
}

function setTheme(theme) {
    const body = document.body;
    const root = document.documentElement;
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';

    try {
        localStorage.setItem('cm_theme_cache', normalizedTheme);
    } catch (error) {
        /* no-op */
    }

    root.dataset.theme = normalizedTheme;
    root.classList.toggle('dark-theme', normalizedTheme === 'dark');

    if (body) {
        body.dataset.theme = normalizedTheme;
        body.classList.toggle('dark-theme', normalizedTheme === 'dark');
    }

    if (normalizedTheme === 'dark') {
        root.style.backgroundColor = '#2c3e50';
        if (body) {
            body.style.backgroundColor = '#2c3e50';
        }
    } else {
        root.style.backgroundColor = '';
        if (body) {
            body.style.backgroundColor = '';
        }
    }

    const preloadStyle = document.getElementById('cm-theme-preload-style');
    if (preloadStyle) {
        preloadStyle.remove();
    }
}

function setSafeHTML(element, html) {
    const template = document.createElement('template');
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');

    while (parsed.body.firstChild) {
        template.content.appendChild(parsed.body.firstChild);
    }

    sanitizeChildren(template.content);

    element.textContent = '';
    element.appendChild(template.content.cloneNode(true));
}

function sanitizeChildren(parent) {
    Array.from(parent.children).forEach((child) => {
        sanitizeChildren(child);
        sanitizeElement(child);
    });
}

function sanitizeElement(element) {
    const allowedTags = ['A', 'BR', 'EM', 'SPAN'];
    if (!allowedTags.includes(element.tagName)) {
        element.replaceWith(document.createTextNode(element.textContent));
        return;
    }

    Array.from(element.attributes).forEach((attribute) => {
        if (!isAllowedAttribute(element, attribute)) {
            element.removeAttribute(attribute.name);
        }
    });

    if (element.tagName === 'A' && element.target === '_blank') {
        element.rel = 'noopener noreferrer';
    }
}

function isAllowedAttribute(element, attribute) {
    if (element.tagName === 'A') {
        if (attribute.name === 'href') {
            return isSafeHref(attribute.value);
        }
        if (attribute.name === 'target') {
            return attribute.value === '_blank';
        }
        if (attribute.name === 'rel') {
            return attribute.value === 'noopener noreferrer';
        }
    }

    return element.tagName === 'SPAN' && attribute.name === 'id';
}

function isSafeHref(href) {
    try {
        const url = new URL(href, window.location.href);
        return ['https:', 'http:', 'chrome-extension:', 'moz-extension:'].includes(url.protocol);
    } catch (e) {
        return false;
    }
}


