document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    SetupDynamicDataFromDB(data.MessageToYourself);
    UpdateFooterState();
});

window.addEventListener('load', async () => {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('confirmReflectionButton').addEventListener('click', function () {
        UpdateProgressionAndProceed(() => completeCurrentCardAndProceed("MessageToYourself.html"));
    });
});

function dataLoadFromBase(MessageToYourself) {
    let message = MessageToYourself.content[0];
    document.getElementById('userImage').src = message.image;
    setSafeHTML(document.getElementById('userText'), message.text);
    document.getElementById('confirmReflectionButton').innerText = MessageToYourself.static;
}

async function SetupDynamicDataFromDB(MessageToYourself) {
    let slideDataVarValue = await new Promise((resolve) => {
        chrome.storage.local.get(['SlidesDataVar_MessageToYourself'], (result) => {
            resolve(result.SlidesDataVar_MessageToYourself || 0);
        });
    });
    let countOfUserPages = await new Promise((resolve) => {
        chrome.storage.local.get('userSlides', (result) => {
            const slides = result.userSlides || [];
            const slidesWithContent = slides.filter(slide => slide && (slide.text || slide.image));
            const countOfPages = slidesWithContent.length;
            if (countOfPages > 0) {
                for (let i = 0; i < countOfPages; i++) {
                    if (i === slideDataVarValue) {
                        document.getElementById('userImage').src = slidesWithContent[i].image;
                        document.getElementById('userText').innerText = slidesWithContent[i].text;
                        break;
                    }
                }
            }
            resolve(countOfPages);
        });
    });
    if (countOfUserPages > 0) {
        // Iterate and save progress
        slideDataVarValue = slideDataVarValue + 1;
        if (slideDataVarValue >= countOfUserPages) {
            slideDataVarValue = 0;
        }
        chrome.storage.local.set({ 'SlidesDataVar_MessageToYourself': slideDataVarValue });
		
		document.getElementById('confirmReflectionButton').innerText = MessageToYourself.static;
    }
    else {
        dataLoadFromBase(MessageToYourself);
    }
}
