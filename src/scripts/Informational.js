document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    dataLoadFromBase(data.Informational);
    UpdateFooterState();
});

window.addEventListener('load', async () => {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('nowIKnowButton').addEventListener('click', function () {
        UpdateProgressionAndProceed(() => completeCurrentCardAndProceed("Informational.html"));
    });
});

function dataLoadFromBase(Informational) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('SlidesDataVar_Informational', (result) => {
            const dataIndex = result.SlidesDataVar_Informational || 0;

            const fact = Informational.content[dataIndex] || {};
            setSafeHTML(document.getElementById('factTitle'), fact.title);
            setSafeHTML(document.getElementById('factText'), fact.text);
            document.getElementById('nowIKnowButton').textContent = Informational.static;

            const iteratedDataIndex = (dataIndex + 1) % Informational.content.length;

            chrome.storage.local.set({ SlidesDataVar_Informational: iteratedDataIndex }, () => {
                resolve();
            });
        });
    });
}

