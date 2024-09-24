let timeLeft = 30;
let timerId;

document.addEventListener('DOMContentLoaded', async () => {
	const data = await getDB();
	dataLoadFromBase(data.SimpleAction);
	UpdateFooterState();
});

window.addEventListener('load', async () => {
	document.getElementById('mainContainer').style.opacity = '1';
	document.getElementById('confirmButton').addEventListener('click', function () { UpdateProgressionAndProceed(confirmPushups); });
	startTimer();
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

function dataLoadFromBase(SimpleAction) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get('SlidesDataVar_SimpleAction', (result) => {
			const dataIndex = result.SlidesDataVar_SimpleAction;

			const fact = SimpleAction.content[dataIndex];

			document.getElementById('actionText').innerHTML = fact;

			const iteratedDataIndex = (dataIndex + 1) % SimpleAction.content.length;

			chrome.storage.local.set({ SlidesDataVar_SimpleAction: iteratedDataIndex }, () => {
				resolve();
			});
		});
	});
};

function startTimer() {
	const confirmButton = document.getElementById('confirmButton');
	timerId = setInterval(() => {
		if (timeLeft > 0) {
			timeLeft--;
			confirmButton.textContent = timeLeft;
		} else {
			clearInterval(timerId);
			confirmButton.disabled = false;
			confirmButton.textContent = 'Confirm';
		}
	}, 1000);
}

function confirmPushups() {
	var container = document.getElementById('mainContainer');
	container.style.opacity = '0';


	setTimeout(async function () {
		console.log("Pushups confirmed");
		await registerCardUsage_cycle("SimpleAction.html");
		//
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