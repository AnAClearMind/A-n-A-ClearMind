document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    dataLoadFromBase(data.Quote);
    UpdateFooterState();
});

window.addEventListener('load', async () => {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('quoteReflectionButton').addEventListener('click', function () {
        UpdateProgressionAndProceed(() => completeCurrentCardAndProceed("Quote.html"));
    });
});

function dataLoadFromBase(Quote) {
    const question = document.getElementById('question');
    const quoteReflection = document.getElementById('quoteReflection');
    const quoteReflectionButton = document.getElementById('quoteReflectionButton');

    question.textContent = Quote.static.question;
    quoteReflection.placeholder = Quote.static.quoteReflection;
    quoteReflectionButton.textContent = Quote.static.quoteReflectionButton;

    return new Promise((resolve, reject) => {
        chrome.storage.local.get('SlidesDataVar_Quote', (result) => {
            const dataIndex = result.SlidesDataVar_Quote || 0;

            const fact = Quote.content[dataIndex] || '';
            const formattedText = fact.replace(/["']/g, () => `&quot;`);

            setSafeHTML(document.getElementById('quoteText'), formattedText);

            const iteratedDataIndex = (dataIndex + 1) % Quote.content.length;

            chrome.storage.local.set({ SlidesDataVar_Quote: iteratedDataIndex }, () => {
                resolve();
            });
        });
    });
}
