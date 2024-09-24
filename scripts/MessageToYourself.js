document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    SetupDynamicDataFromDB(data.MessageToYourself);
    UpdateFooterState();
});

window.addEventListener('load', async () => {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('confirmReflectionButton').addEventListener('click', function () { UpdateProgressionAndProceed(confirmReflection); });
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

function dataLoadFromBase(MessageToYourself) {
    let message = MessageToYourself.content[0];
    document.getElementById('userImage').src = message.image;
    document.getElementById('userText').innerHTML = message.text;
    document.getElementById('confirmReflectionButton').innerText = MessageToYourself.static;
};


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
            console.log(countOfPages)
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


function confirmReflection() {
    var container = document.getElementById('mainContainer');
    container.style.opacity = '0';
    //
    setTimeout(async function () {
        await registerCardUsage_cycle("MessageToYourself.html");
        const randomCard = await requestNextCard();
        if (randomCard) {
            console.log("Random card selected:", randomCard);
            window.location.href = `${randomCard}`;
        }
        else {
            console.log("No cards left, going to UrgeTest_final");
            window.location.href = '../pages/UrgeTest_final.html';;
        }
    }, 1000);
}