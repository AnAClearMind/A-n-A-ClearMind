document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    dataLoadFromBase(data.Video);
    UpdateFooterState();
});

window.addEventListener('load', async () => {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('confirmVideoButton').addEventListener('click', function () {
        console.log("Video confirmed");
        UpdateProgressionAndProceed(() => completeCurrentCardAndProceed("Video.html"));
    });
});

function dataLoadFromBase(Video) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('SlidesDataVar_Video', (result) => {
            const dataIndex = result.SlidesDataVar_Video || 0;

            const fact = Video.content[dataIndex] || '';

            document.getElementById('viewport').src = fact;
            document.getElementById('confirmVideoButton').textContent = Video.static;

            const iteratedDataIndex = (dataIndex + 1) % Video.content.length;

            chrome.storage.local.set({ SlidesDataVar_Video: iteratedDataIndex }, () => {
                resolve();
            });
        });
    });
}
