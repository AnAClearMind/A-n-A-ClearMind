let currentProgress;
let scaleDivs;
const maxProgressValue = 70;

function UpdateFooterState() {
    scaleDivs = document.querySelectorAll(".scale div");
    chrome.storage.local.get(['progress'], function (result) {
        let progress = Math.min(result.progress || 0, maxProgressValue);
        currentProgress = progress;
        for (let i = 0; i < progress && i < scaleDivs.length; i++) {
            scaleDivs[i].classList.add('filled');
        }
    });
}

function RegisterProgressTick() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ progress: currentProgress + 1 }, resolve);
    });
}

async function UpdateProgressionAndProceed(proceedFunction) {
    if (currentProgress < maxProgressValue) {
        await RegisterProgressTick();
        const nextDiv = scaleDivs[currentProgress];
        nextDiv.classList.add('filled');
        let rewardLevel = 0;
        switch (currentProgress + 1) {
            case 5: {
                rewardLevel = 1;
                break;
            }
            case 14: {
                rewardLevel = 2;
                break;
            }
            case 28: {
                rewardLevel = 3;
                break;
            }
            case 46: {
                rewardLevel = 4;
                break;
            }
            case 70: {
                rewardLevel = 5;
                break;
            }
        }

        if (nextDiv.classList.contains('reward')) {
            loadJSON().then(data => {
                showPopup(proceedFunction, data.ProgressionPopup, data.ProgressionPopup.rewards[rewardLevel]);
            });
        }
        else {
            proceedFunction();
        }
    }
    else {
        proceedFunction();
    }

    function showPopup(proceedFunction, ProgressionPopupData, rewardData) {
        chrome.storage.local.get(['sys_theme'], function (result) {
            const isDarkTheme = result.sys_theme === 'dark';
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.zIndex = '1000';

            const popup = document.createElement('div');
            popup.style.backgroundColor = isDarkTheme ? '#333' : 'white';
            popup.style.padding = '30px';
            popup.style.borderRadius = '10px';
            popup.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
            popup.style.textAlign = 'center';
            popup.style.maxWidth = '400px';
            popup.style.width = '80%';

            const title = document.createElement('h2');
            title.innerText = ProgressionPopupData.static.p;
            title.style.marginBottom = '10px';
            title.style.color = isDarkTheme ? '#ecf0f1' : '#2c3e50';

            const message = document.createElement('p');
            message.innerText = rewardData.title;
            message.style.marginBottom = '20px';
            message.style.fontSize = '14px';
            message.style.color = isDarkTheme ? '#ecf0f1' : '#2c3e50';

            const closeButton = document.createElement('button');
            closeButton.innerText = ProgressionPopupData.static.closeButton;
            closeButton.style.backgroundColor = '#e74c3c';
            closeButton.style.color = 'white';
            closeButton.style.border = 'none';
            closeButton.style.padding = '10px 20px';
            closeButton.style.borderRadius = '5px';
            closeButton.style.cursor = 'pointer';
            closeButton.style.marginRight = '10px';

            const claimButton = document.createElement('button');
            claimButton.innerText = ProgressionPopupData.static.claimButton;
            claimButton.style.backgroundColor = '#2ecc71';
            claimButton.style.color = 'white';
            claimButton.style.border = 'none';
            claimButton.style.padding = '10px 20px';
            claimButton.style.borderRadius = '5px';
            claimButton.style.cursor = 'pointer';

            closeButton.addEventListener('click', function () {
                overlay.style.opacity = '0';
                proceedFunction();
            });

            claimButton.addEventListener('click', function () {
                window.open(rewardData.link, '_blank');
            });

            popup.appendChild(title);
            popup.appendChild(message);
            popup.appendChild(closeButton);
            popup.appendChild(claimButton);
            overlay.appendChild(popup);
            document.body.appendChild(overlay);
        });
    }
}


async function loadJSON() {
    const language = await new Promise((resolve, reject) => {
        chrome.storage.local.get('sys_language', (result) => {
            if (result.sys_language) {
                resolve(result.sys_language);
            } else {
                reject('Language not found in storage');
            }
        });
    });

    const response = await fetch(`../DB/${language}-DB.json`);
    const data = await response.json();
    return data;
}