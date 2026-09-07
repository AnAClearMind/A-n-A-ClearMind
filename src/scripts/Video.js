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

function getYouTubeDetails(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:embed\/|v\/|watch\?v=)([\w-]{11})/);
    const videoId = match ? match[1] : null;
    if (!videoId) return null;

    let start = '';
    try {
        const parsed = new URL(url, 'https://www.youtube.com');
        start = parsed.searchParams.get('start') || '';
    } catch (e) {}

    const watchUrl = `https://www.youtube.com/watch?v=${videoId}${start ? `&t=${start}s` : ''}`;
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    return { videoId, watchUrl, thumbnailUrl };
}

function openVideoWindow(watchUrl) {
    if (!watchUrl) return;
    if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.create) {
        chrome.windows.create({
            url: watchUrl,
            type: 'popup',
            width: 960,
            height: 560
        }, (win) => {
            if (chrome.runtime.lastError || !win) {
                chrome.tabs.create({ url: watchUrl });
            }
        });
    } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: watchUrl });
    } else {
        window.open(watchUrl, '_blank', 'noopener,noreferrer');
    }
}

function dataLoadFromBase(Video) {
    return new Promise((resolve) => {
        chrome.storage.local.get('SlidesDataVar_Video', (result) => {
            const dataIndex = result.SlidesDataVar_Video || 0;
            const fact = Video.content[dataIndex] || '';

            const details = getYouTubeDetails(fact);
            const preview = document.getElementById('videoPreview');
            const thumbnail = document.getElementById('videoThumbnail');

            if (details && preview && thumbnail) {
                thumbnail.src = details.thumbnailUrl;
                preview.addEventListener('click', () => openVideoWindow(details.watchUrl));
                preview.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openVideoWindow(details.watchUrl);
                    }
                });
            }

            document.getElementById('confirmVideoButton').textContent = Video.static;

            const iteratedDataIndex = (dataIndex + 1) % Video.content.length;

            chrome.storage.local.set({ SlidesDataVar_Video: iteratedDataIndex }, () => {
                resolve();
            });
        });
    });
}
