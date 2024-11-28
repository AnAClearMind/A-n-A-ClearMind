document.addEventListener('DOMContentLoaded', async function () {
    const data = await getDB();
    dataLoadFromBase(data.customBlockControl_popup, data.Sys_links);

    const addDomainBtn = document.getElementById('addDomainBtn');
    const deleteDomainBtn = document.getElementById('deleteDomainBtn');
    const domainInput = document.getElementById('domainInput');
    const message = document.getElementById('message');
    document.getElementById('settingsButton').addEventListener('click', function () {
        window.open('About.html');
    });
	document.getElementById('alertButton').addEventListener('click', function () {
		window.open('UrgeTest_initial.html');
	});
	

    function extractDomain(url) {
        const urlObj = new URL(url);
        console.log(urlObj.origin);
        if (urlObj.origin.includes('chrome-extension://') || urlObj.origin.includes('moz-extension://')) {
            const blockedDomain = urlObj.searchParams.get('blocked');
            if (blockedDomain) {
                return blockedDomain ? blockedDomain : '';
            }
            return '';
        }
        else{
            const domain = urlObj.hostname;
            const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (domainPattern.test(domain)) {
                return domain;
            }
            return '';
        }
    }

    // Get current tab's URL and fill in the domain
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0] && tabs[0].url) {
            const currentDomain = extractDomain(tabs[0].url);
            domainInput.value = currentDomain;
            toggleButtons();
        }
    });

    // Enable/Disable buttons based on input
    function toggleButtons() {
        const domain = domainInput.value.trim();
        deleteDomainBtn.disabled = !domain;
        addDomainBtn.disabled = !domain;
    }

    domainInput.addEventListener('input', toggleButtons);

    addDomainBtn.addEventListener('click', function () {
        const domain = domainInput.value.trim();
        if (domain) {
            chrome.runtime.sendMessage({ action: "addDomain", domain: domain }, function (response) {
                if (response.success) {
                    message.textContent = response.message;
                    domainInput.value = '';
                    toggleButtons();
                } else {
                    message.textContent = `Error: ${response.error}`;
                }
            });
        } else {
            message.textContent = 'Please enter a valid domain.';
        }
    });

    deleteDomainBtn.addEventListener('click', function () {
        const domain = domainInput.value.trim();
        if (domain) {
            chrome.runtime.sendMessage({ action: "deleteDomain", domain: domain }, function (response) {
                if (response.success) {
                    message.textContent = response.message;
                    domainInput.value = '';
                    toggleButtons();
                } else {
                    message.textContent = `Error: ${response.error}`;
                }
            });
        }
    });
});

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

function dataLoadFromBase(customBlockControl_popup, Sys_links) {

    const h2 = document.querySelector('h2');
    const domainInput = document.getElementById('domainInput');
    const addDomainBtn = document.getElementById('addDomainBtn');
    const deleteDomainBtn = document.getElementById('deleteDomainBtn');
	const alertButton = document.getElementById('alertButton');
    const settingsButton = document.getElementById('settingsButton').querySelector('span');
    const supportButton = document.getElementById('supportButton').querySelector('span');

    h2.textContent = customBlockControl_popup.static.h2;
    domainInput.placeholder = customBlockControl_popup.static.domainInput;
    addDomainBtn.textContent = customBlockControl_popup.static.addDomainBtn;
    deleteDomainBtn.textContent = customBlockControl_popup.static.deleteDomainBtn;
	alertButton.textContent = customBlockControl_popup.static.alertButton;
    settingsButton.textContent = customBlockControl_popup.static.settingsButton;
    supportButton.textContent = customBlockControl_popup.static.supportButton;
    document.getElementById('supportButton').addEventListener('click', function () {
        window.open(Sys_links.support, '_blank');
    });
};