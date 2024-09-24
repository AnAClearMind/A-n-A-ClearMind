checkSysTheme();

async function checkSysTheme() {
    try {
        const sysTheme = await getSysTheme();
        setTheme(sysTheme);
    } catch (error) {
        setTheme('light');
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
    if (theme === 'dark') {
        body.classList.add('dark-theme');
    } else {
        body.classList.remove('dark-theme');
    }
}


