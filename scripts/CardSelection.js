let selectedCard = -1;
let poolOfCards = [];
let data;

document.addEventListener('DOMContentLoaded', async () => {
    await getDB();
    StaticDataLoadFromBase(data.CardSelection);
	UpdateFooterState();
});

async function getDB() {
    data = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getData' }, (response) => {
            if (response) {
                resolve(response);
            } else {
                reject('Failed to load data');
            }
        });
    });
}

function StaticDataLoadFromBase(CardSelection) {
    const h1 = document.querySelector('h1');
    const chooseCard = document.getElementById('chooseCard');
    const confirmChoice = document.getElementById('confirmChoice');

    h1.textContent = CardSelection.static.h1;
    chooseCard.textContent = CardSelection.static.chooseCard;
    confirmChoice.textContent = CardSelection.static.confirmChoice;
}

window.onload = async function () {
    setTimeout(() => { document.getElementById('mainContainer').style.opacity = '1'; }, 150);

    document.getElementById('selectCard0').addEventListener('click', function () { selectCard(0); });
    document.getElementById('selectCard1').addEventListener('click', function () { selectCard(1); });
    document.getElementById('selectCard2').addEventListener('click', function () { selectCard(2); });
    document.getElementById('chooseCard').addEventListener('click', chooseCard);
    document.getElementById('confirmChoice').addEventListener('click', confirmChoice);
    await ResetCycleVariables();
    await GetCardsPool();
};

async function GetCardsPool() {
    let customExclusionsList = [];

    const cycleInSessionCounter = await new Promise((resolve) => {
        chrome.storage.local.get(['cycleInSessionCounter'], (result) => {
            resolve(result.cycleInSessionCounter || 0);
        });
    });

    if (cycleInSessionCounter === 0) {
        customExclusionsList.push("MessageToYourself.html");
    } else if (cycleInSessionCounter === 3) {
        await new Promise((resolve) => {
            chrome.storage.local.set({ slidesUsedInSession: [] }, () => {
                console.log(`slidesUsedInSession has been cleared.`);
                resolve();
            });
        });
        chrome.storage.local.set({ cycleInSessionCounter: 0 });
    }

    const slidesUsedInSession = await new Promise((resolve) => {
        chrome.storage.local.get(['slidesUsedInSession'], (result) => {
            resolve(result.slidesUsedInSession || []);
        });
    });

    let allExclusions = [...customExclusionsList, ...slidesUsedInSession];

    const randomCard0 = await getRandomCard(allExclusions);
    poolOfCards.push(randomCard0);
    allExclusions.push(...poolOfCards);
    const randomCard1 = await getRandomCard(allExclusions);
    poolOfCards.push(randomCard1);
    allExclusions.push(...poolOfCards);
    const randomCard2 = await getRandomCard(allExclusions);
    poolOfCards.push(randomCard2);

    SetAliasAndIcon('selectCard0', randomCard0);
    SetAliasAndIcon('selectCard1', randomCard1);
    SetAliasAndIcon('selectCard2', randomCard2);
}

function SetAliasAndIcon(CardID, SelectedRandomCard) {
    const FormattedSelectedRandomCard = SelectedRandomCard.split('.').slice(0, -1).join('.');
    const elementID = document.getElementById(CardID);
    elementID.querySelector('p').textContent = data[FormattedSelectedRandomCard].alias;
    elementID.querySelector('i').classList.add(...data[FormattedSelectedRandomCard].icon);
}

async function ResetCycleVariables() {
    await cleanCardUsage_cycle();
    chrome.storage.local.set({ cycleIterator: 0 });
}

function selectCard(index) {
    const cards = document.getElementsByClassName('card-option');
    for (let i = 0; i < cards.length; i++) {
        cards[i].classList.remove('selected');
    }
    cards[index].classList.add('selected');
    selectedCard = index;
}

function chooseCard() {
    if (selectedCard === -1) return;

    const cards = document.getElementsByClassName('card-option');
    const cardContainer = document.getElementById('cardContainer');

    cardContainer.style.justifyContent = 'center';

    for (let i = 0; i < cards.length; i++) {
        if (i !== selectedCard) {
            cards[i].style.opacity = '0';
            cards[i].style.transform = 'scale(0.8)';
        } else {
            cards[i].style.transform = 'scale(1.1)';
        }
    }

    setTimeout(() => {
        for (let i = 0; i < cards.length; i++) {
            if (i !== selectedCard) {
                cards[i].style.display = 'none';
            }
        }

        const selectedCardElement = cards[selectedCard];
        selectedCardElement.style.width = '300px';
        selectedCardElement.querySelector('i').style.fontSize = '64px';
        selectedCardElement.querySelector('p').style.fontSize = '24px';

        confirmChoice();
    }, 500);
}

function confirmChoice() {
    var container = document.getElementById('mainContainer');
    container.style.opacity = '0';

    setTimeout(async function () {
        console.log("Choice confirmed:", selectedCard);
        window.location.href = `../pages/${poolOfCards[selectedCard]}`;
    }, 1000);
}