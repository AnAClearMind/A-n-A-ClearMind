document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    dataLoadFromBase(data.Wife);
    UpdateFooterState();
});

window.onload = async function () {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('confirmDescriptionButton').addEventListener('click', function () { UpdateProgressionAndProceed(confirmDescription); });
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

function dataLoadFromBase(Wife) {
    const h1 = document.querySelector('h1');
    const wifeDescription = document.getElementById('wifeDescription');
    const confirmDescriptionButton = document.getElementById('confirmDescriptionButton');
    //
    h1.textContent = Wife.static.h1;
    wifeDescription.placeholder = Wife.static.wifeDescription;
    confirmDescriptionButton.textContent = Wife.static.confirmDescriptionButton;
};

function confirmDescription() {
    var container = document.getElementById('mainContainer');
    container.style.opacity = '0';

    setTimeout(async function () {
        await registerCardUsage_cycle("Wife.html");

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
