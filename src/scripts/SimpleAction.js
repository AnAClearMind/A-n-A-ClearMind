let timeLeft = 30;
let timerId;

document.addEventListener('DOMContentLoaded', async () => {
	const data = await getDB();
	dataLoadFromBase(data.SimpleAction);
	UpdateFooterState();
});

window.addEventListener('load', async () => {
	document.getElementById('mainContainer').style.opacity = '1';
	document.getElementById('confirmButton').addEventListener('click', function () {
		UpdateProgressionAndProceed(() => completeCurrentCardAndProceed("SimpleAction.html"));
	});
	startTimer();
});

function dataLoadFromBase(SimpleAction) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get('SlidesDataVar_SimpleAction', (result) => {
			const dataIndex = result.SlidesDataVar_SimpleAction || 0;

			const fact = SimpleAction.content[dataIndex] || '';

			setSafeHTML(document.getElementById('actionText'), fact);

			const iteratedDataIndex = (dataIndex + 1) % SimpleAction.content.length;

			chrome.storage.local.set({ SlidesDataVar_SimpleAction: iteratedDataIndex }, () => {
				resolve();
			});
		});
	});
}

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
