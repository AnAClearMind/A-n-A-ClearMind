const actualCardsPool = [
    "Quote.html",
    "Informational.html",
    "Trigger.html",
    "ImagineWords.html",
    "Wife.html",
    "Video.html",
    "SimpleAction.html",
    "PictureSelection.html",
    "MessageToYourself.html"
];

function registerCardUsage_cycle(cardToRegisterName) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('slidesUsedInCycle', (result) => {
            let slidesUsedInCycle_data = result.slidesUsedInCycle || [];
            if (!Array.isArray(slidesUsedInCycle_data)) {
                slidesUsedInCycle_data = [];
            }
            slidesUsedInCycle_data.push(cardToRegisterName);
            chrome.storage.local.set({ slidesUsedInCycle: slidesUsedInCycle_data }, () => {
                console.log('Карточка зарегистрирована в цикле.');
                resolve();
            });
        });
    });
}

function registerCardUsage_session() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['slidesUsedInCycle', 'slidesUsedInSession'], function (result) {
            const array1 = result.slidesUsedInCycle || [];
            const array2 = result.slidesUsedInSession || [];
            const mergedArray = array2.concat(array1);
            chrome.storage.local.set({ slidesUsedInSession: mergedArray }, function () {
                console.log('slidesUsedInSession has been updated:', mergedArray);
                resolve();
            });
        });
    });
}

function cleanCardUsage_cycle() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.remove('slidesUsedInCycle', () => {
            if (chrome.runtime.lastError) {
                console.error('Error on deleting key:', chrome.runtime.lastError);
            } else {
                console.log('Key slidesUsedInCycle successfuly deleted.');
                resolve();
            }
        });
    });
}

function getSlidesUsedInCycle() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('slidesUsedInCycle', (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result.slidesUsedInCycle || []);
            }
        });
    });
}

function getRandomElement(array) {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
}

async function getRandomCard(additionalExclusions = []) {
    try {
        const slidesUsedInCycle = await getSlidesUsedInCycle();
        const allExclusions = [...slidesUsedInCycle, ...additionalExclusions]; 
        const availableCards = actualCardsPool.filter(card => !allExclusions.includes(card));
        const cycleInSessionCounter = await new Promise((resolve) => {
            chrome.storage.local.get(['cycleInSessionCounter'], (result) => {
                resolve(result.cycleInSessionCounter || 0);
            });
        });
        if (availableCards.length === 0) {
            if (cycleInSessionCounter<3){
                if (!slidesUsedInCycle.includes("PictureSelection.html")) {
                    availableCards.push("PictureSelection.html");
                }
                else{
                    availableCards.push("SimpleAction.html");
                }
            }
            else{
                console.log("No cards available to select.");
                return null;
            }
        }
        const randomCard = getRandomElement(availableCards);
        console.log("Selected card:", randomCard);
        return randomCard;
    } catch (error) {
        console.error("Error selecting random card:", error);
    }
}

async function requestNextCard() {
    try {
        await updateIterator_cycle();
        const cycleIterator = await getCycleIterator();
        if (cycleIterator >= 3) {
            console.log("No cards available to select (=> end of current cycle 3/3).");
            return null;
        }

        let customExclusionsList = [];
        const cycleInSessionCounter = await new Promise((resolve) => {
            chrome.storage.local.get(['cycleInSessionCounter'], (result) => {
                resolve(result.cycleInSessionCounter || 0);
            });
        });
        if (cycleInSessionCounter === 0) {
            customExclusionsList.push("MessageToYourself.html");
        }
        const slidesUsedInSession = await new Promise((resolve) => {
            chrome.storage.local.get(['slidesUsedInSession'], (result) => {
                resolve(result.slidesUsedInSession || []);
            });
        });
        const slidesUsedInCycle = await getSlidesUsedInCycle();
        const specialSlides = ['Wife.html', 'Trigger.html', 'Quote.html', 'ImagineWords.html'];
        const writeOutSlidesToMissInCycle = specialSlides.filter(slide => !slidesUsedInCycle.includes(slide));
        let allExclusions = [...customExclusionsList, ...slidesUsedInSession, ...writeOutSlidesToMissInCycle];

        const randomCard = await getRandomCard(allExclusions);
        return randomCard;
    } catch (error) {
        console.error("Error selecting random card:", error);
        return null;
    }
}

function updateIterator_cycle() {
    return new Promise((resolve) => {
        chrome.storage.local.get('cycleIterator', (result) => {
            const newIterator = (result.cycleIterator || 0) + 1;
            chrome.storage.local.set({ cycleIterator: newIterator }, resolve);
        });
    });
}

function getCycleIterator() {
    return new Promise((resolve) => {
        chrome.storage.local.get('cycleIterator', (result) => {
            resolve(result.cycleIterator || 0);
        });
    });
}