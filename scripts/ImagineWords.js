document.addEventListener('DOMContentLoaded', async () => {
	const data = await getDB();
	dataLoadFromBase(data.ImagineWords);
	UpdateFooterState();
});

window.onload = async function () {
	document.getElementById('mainContainer').style.opacity = '1';
	document.getElementById('wordsButton').addEventListener('click', function () { UpdateProgressionAndProceed(confirmTrigger); });
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


function dataLoadFromBase(ImagineWords) {
	const p = document.querySelector('p');
	const wordsDescription = document.getElementById('wordsDescription');
	const wordsButton = document.getElementById('wordsButton');

	p.innerHTML = ImagineWords.static.p;
	wordsDescription.placeholder = ImagineWords.static.wordsDescription;
	wordsButton.innerHTML = ImagineWords.static.wordsButton;

};

function confirmTrigger() {
	var container = document.getElementById('mainContainer');
	container.style.opacity = '0';
	//
	setTimeout(async function () {
		await registerCardUsage_cycle("ImagineWords.html");
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
