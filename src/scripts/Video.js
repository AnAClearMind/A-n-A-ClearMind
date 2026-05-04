document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    dataLoadFromBase(data.Video);
	UpdateFooterState();
});

window.addEventListener('load', async () => {
	document.getElementById('mainContainer').style.opacity = '1';
	document.getElementById('confirmVideoButton').addEventListener('click', function () { UpdateProgressionAndProceed(confirmVideo); });
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

function dataLoadFromBase(Video) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get('SlidesDataVar_Video', (result) => {
			const dataIndex = result.SlidesDataVar_Video;

			const fact = Video.content[dataIndex];

			document.getElementById('viewport').src = fact;
			document.getElementById('confirmVideoButton').textContent = Video.static;

			const iteratedDataIndex = (dataIndex + 1) % Video.content.length;

			chrome.storage.local.set({ SlidesDataVar_Video: iteratedDataIndex }, () => {
				resolve();
			});
		});
	});
};

function confirmVideo() {
	var container = document.getElementById('mainContainer');
	container.style.opacity = '0';

	setTimeout(async function () {
		console.log("Video confirmed");
		await registerCardUsage_cycle("Video.html");

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
