document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
	dataLoadFromBase(data.Trigger);
    UpdateFooterState();
  });

window.onload = async function () {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('triggerButton').addEventListener('click', function () { UpdateProgressionAndProceed(confirmTrigger); });
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

function dataLoadFromBase(Trigger) {
	
	const h1 = document.querySelector('h1');
	const p = document.querySelector('p');
	const triggerDescription = document.getElementById('triggerDescription');
	const triggerButton = document.getElementById('triggerButton');
	
	h1.textContent = Trigger.static.h1;
	p.textContent = Trigger.static.p;
	triggerDescription.placeholder = Trigger.static.triggerDescription;
	triggerButton.textContent = Trigger.static.triggerButton;
	
};

function confirmTrigger() {
    var trigger = document.getElementById("triggerDescription").value;
    var container = document.getElementById('mainContainer');
    container.style.opacity = '0';

    setTimeout(async function () {
        console.log("Trigger identified: " + trigger);
        await registerCardUsage_cycle("Trigger.html");
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

