document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    dataLoadFromBase(data.UrgeTest_initial);
});

window.onload = async function () {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('headerItem').style.opacity = '1';
    document.getElementById('confirmButton').addEventListener('click', confirmUrge);
    //
    CleanSessionDataBetweenDifferentSessions();
    checkSize();
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

function dataLoadFromBase(UrgeTest_initial) {

    const h1 = document.querySelector('h1');
    const p = document.getElementById('textMain');
    const confirmButton = document.querySelector('button');
    const pS = document.getElementById('textSecondary');

    p.innerHTML = UrgeTest_initial.static.textMain;
    h1.innerHTML = UrgeTest_initial.static.h1;
    confirmButton.textContent = UrgeTest_initial.static.confirmButton;
    pS.innerHTML = UrgeTest_initial.static.textSecondary;

    //fill blocked site name for header
    const urlParams = new URLSearchParams(window.location.search);
    const blockedDomain = urlParams.get('blocked');
    if (blockedDomain) {
        document.getElementById('blockedDomain').textContent = decodeURIComponent(blockedDomain);
        document.getElementById('blockedDomainOverlay').textContent = decodeURIComponent(blockedDomain);
    } else {
        document.getElementById('blockedDomain').textContent = 'Unknown';
        document.getElementById('blockedDomainOverlay').textContent = 'Unknown';
    }
};

function checkSize() {
    var overlay = document.getElementById('overlay');
    var userAgent = navigator.userAgent.toLowerCase();
    var isMobile = userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone');

    if (isMobile) {
        overlay.style.display = 'none';
    } else {
        if (window.innerWidth < 1000 || window.innerHeight < 600) {
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
        }
    }
}

window.addEventListener('resize', checkSize);

async function CleanSessionDataBetweenDifferentSessions() {
    await new Promise((resolve) => {
        chrome.storage.local.set({ slidesUsedInSession: [] }, () => {
            console.log(`slidesUsedInSession has been cleared.`);
            resolve();
        });
    });
}

function confirmUrge() {
    var pageBody = document.getElementById('mainContainer');
    pageBody.style.opacity = '0';
    var headerBody = document.getElementById('headerItem');
    headerBody.style.opacity = '0';
    //
    const slider = document.getElementById('urgeSlider');
    const selectedValue = slider.value;
    chrome.storage.local.set({ urge_initial: selectedValue });

    setTimeout(function () {
        window.location.href = '../pages/CardSelection.html';
    }, 1000); // 1000ms matches the transition duration in CSS
}