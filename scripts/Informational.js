document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    dataLoadFromBase(data.Informational);
    UpdateFooterState();
});

window.addEventListener('load', async () => {
	document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('nowIKnowButton').addEventListener('click', function () { UpdateProgressionAndProceed(confirm); });
});

	
function dataLoadFromBase(Informational) {
	
	return new Promise((resolve, reject) => {
        chrome.storage.local.get('SlidesDataVar_Informational', (result) => {
            const dataIndex = result.SlidesDataVar_Informational;
			
			const fact = Informational.content[dataIndex];		
			document.getElementById('factTitle').innerHTML = fact.title;
			document.getElementById('factText').innerHTML = fact.text;
			document.getElementById('nowIKnowButton').textContent = Informational.static;
			
			const iteratedDataIndex = (dataIndex + 1) % Informational.content.length;
            
			chrome.storage.local.set({ SlidesDataVar_Informational: iteratedDataIndex }, () => {
                resolve();
            });
        });
    });
	
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

function confirm() {
    // Fade out animation
    var container = document.getElementById('mainContainer');
    container.style.opacity = '0';

    // Wait for the fade-out animation to complete, then go back
    setTimeout(async function () {
        await registerCardUsage_cycle("Informational.html");

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

