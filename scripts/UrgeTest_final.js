let initialUrgeValue;
let currentUrgeValue;
let mainHeaderResult;

document.addEventListener('DOMContentLoaded', async () => {
  const data = await getDB();
  dataLoadFromBase(data.UrgeTest_final);
});

window.onload = async function () {
  document.getElementById('mainContainer').style.opacity = '1';
  document.getElementById('confirmButton').addEventListener('click', confirmUrge);
  document.getElementById('resetUrgeButton').addEventListener('click', resetUrge);
  document.getElementById('leaveUrgeButton').addEventListener('click', leaveUrge);

  getValueFromStorage('urge_initial').then(value => {
    initialUrgeValue = value;
  }).catch(error => {
    console.error('Error retrieving value:', error);
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

function dataLoadFromBase(UrgeTest_final) {

  const mainHeader = document.getElementById('mainHeader');
  const motivationalText_lessUrge = document.getElementById('motivationalText_lessUrge');
  const confirmButton = document.getElementById('confirmButton');
  const resetUrgeButton = document.getElementById('resetUrgeButton');
  const leaveUrgeButton = document.getElementById('leaveUrgeButton');

  mainHeader.textContent = UrgeTest_final.static.mainHeader;
  mainHeaderResult = UrgeTest_final.static.mainHeaderResult;
  motivationalText_lessUrge.textContent = UrgeTest_final.static.motivationalText_lessUrge;
  confirmButton.textContent = UrgeTest_final.static.confirmButton;
  resetUrgeButton.textContent = UrgeTest_final.static.resetUrgeButton;
  leaveUrgeButton.textContent = UrgeTest_final.static.leaveUrgeButton;

};

function getValueFromStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], function (result) {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(result[key]);
    });
  });
}

function confirmUrge() {
  currentUrgeValue = document.getElementById('urgeSlider').value;
  const sliderContainer = document.getElementById('sliderContainer');
  const confirmButton = document.getElementById('confirmButton');
  const actionButtons = document.getElementById('actionButtons');
  const mainHeader = document.getElementById('mainHeader');
  const motivationalText_lessUrge = document.getElementById('motivationalText_lessUrge');
  const motivationalText_moreUrge = document.getElementById('motivationalText_moreUrge');

  sliderContainer.style.opacity = '0';
  confirmButton.style.opacity = '0';
  mainHeader.style.opacity = '0';
  
	

  setTimeout(function () {
    mainHeader.innerHTML = mainHeaderResult;
	
	document.getElementById('initialUrgeValueSpan').textContent = initialUrgeValue;
	document.getElementById('currentUrgeValueSpan').textContent = currentUrgeValue;
	
    mainHeader.classList.add('small-header');
    mainHeader.style.opacity = '1';

    sliderContainer.style.display = 'none';
    confirmButton.style.display = 'none';
	

    if (Number(currentUrgeValue) > Number(initialUrgeValue)) {
      motivationalText_moreUrge.style.display = 'flex';
      motivationalText_moreUrge.style.opacity = '1';
    } else {
      motivationalText_lessUrge.style.display = 'flex';
	  
      setTimeout(() => { motivationalText_lessUrge.style.opacity = '1'; }, 800);

    }

    actionButtons.style.display = 'flex';
    actionButtons.style.opacity = '1';
  }, 500);
}


async function resetUrge() {
  chrome.storage.local.get(['cycleInSessionCounter'], (result) => {
    const newValue = (result.cycleInSessionCounter || 0) + 1;
    chrome.storage.local.set({ cycleInSessionCounter: newValue });
  });
  await registerCardUsage_session();
  chrome.storage.local.set({ urge_initial: Number(currentUrgeValue) });
  window.location.href = '../pages/CardSelection.html';
}


function leaveUrge() {
  chrome.storage.local.set({ cycleInSessionCounter: 0 });
  chrome.tabs.query({ currentWindow: true }, function (tabs) {
    if (tabs.length === 1) {
      chrome.tabs.create({}, function () {
        chrome.tabs.getCurrent(function (tab) {
          chrome.tabs.remove(tab.id);
        });
      });
    } else {
      chrome.tabs.getCurrent(function (tab) {
        chrome.tabs.remove(tab.id);
      });
    }
  });
}