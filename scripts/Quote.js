document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    dataLoadFromBase(data.Quote);
    UpdateFooterState();
});

window.addEventListener('load', async () => {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('quoteReflectionButton').addEventListener('click', function () { UpdateProgressionAndProceed(confirmReflection); });
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

function dataLoadFromBase(Quote) {
    const question = document.getElementById('question');
    const quoteReflection = document.getElementById('quoteReflection');
    const quoteReflectionButton = document.getElementById('quoteReflectionButton');

    question.textContent = Quote.static.question;
    quoteReflection.placeholder = Quote.static.quoteReflection;
    quoteReflectionButton.textContent = Quote.static.quoteReflectionButton;

    return new Promise((resolve, reject) => {
        chrome.storage.local.get('SlidesDataVar_Quote', (result) => {
            const dataIndex = result.SlidesDataVar_Quote;

            const fact = Quote.content[dataIndex];
            const formattedText = fact.replace(/["']/g, (match) => `&quot;`);

            document.getElementById('quoteText').innerHTML = formattedText;

            const iteratedDataIndex = (dataIndex + 1) % Quote.content.length;

            chrome.storage.local.set({ SlidesDataVar_Quote: iteratedDataIndex }, () => {
                resolve();
            });
        });
    });
};

function confirmReflection() {
    var container = document.getElementById('mainContainer');
    container.style.opacity = '0';
    //
    setTimeout(async function () {
        await registerCardUsage_cycle("Quote.html");
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