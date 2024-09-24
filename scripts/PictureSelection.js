let pictureSelectionContent;
let selectedImage = null;

document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    dataLoadFromBase(data.PictureSelection);
    UpdateFooterState();
});

window.onload = async function () {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('pictureSelection_img0').addEventListener('click', function () { selectImage(0); });
    document.getElementById('pictureSelection_img1').addEventListener('click', function () { selectImage(1); });
    document.getElementById('pictureSelection_img2').addEventListener('click', function () { selectImage(2); });
    document.getElementById('chooseImageButton').addEventListener('click', chooseImage);
    document.getElementById('confirmChoiceButton').addEventListener('click', function () { UpdateProgressionAndProceed(confirmChoice); });
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

function dataLoadFromBase(PictureSelection) {
    pictureSelectionContent = PictureSelection.content;
    const totalPictureCount = pictureSelectionContent.length;

    const h1 = document.querySelector('h1');
    const chooseImageButton = document.getElementById('chooseImageButton');
    const confirmChoiceButton = document.getElementById('confirmChoiceButton');

    h1.textContent = PictureSelection.static.h1;
    chooseImageButton.textContent = PictureSelection.static.chooseImageButton;
    confirmChoiceButton.textContent = PictureSelection.static.confirmChoiceButton;

    return new Promise((resolve, reject) => {
        chrome.storage.local.get('SlidesDataVar_PictureSelection', (result) => {
            let excludeList = result.SlidesDataVar_PictureSelection || [];

            for (let i = 0; i < 3; i++) {
                let selectedIndex;
                do {
                    selectedIndex = Math.floor(Math.random() * totalPictureCount);
                } while (excludeList.includes(selectedIndex));

                const imgElement = document.getElementById(`pictureSelection_img${i}`);
                imgElement.src = pictureSelectionContent[selectedIndex].image;
                imgElement.alt = pictureSelectionContent[selectedIndex].desc;

                excludeList.push(selectedIndex); // exclude recently used index

                if (excludeList.length === totalPictureCount) {
                    excludeList = [selectedIndex];
                } //reset excludeList if pool is exhausted
            }

            chrome.storage.local.set({ SlidesDataVar_PictureSelection: excludeList }, () => {
                resolve();
            });
        });
    });
}

function selectImage(index) {
    const images = document.getElementsByClassName('image-option');
    for (let i = 0; i < images.length; i++) {
        images[i].classList.remove('selected');
    }
    images[index].classList.add('selected');
    selectedImage = index;
}

function chooseImage() {
    if (selectedImage === null) return;

    const images = document.getElementsByClassName('image-option');
    for (let i = 0; i < images.length; i++) {
        if (i !== selectedImage) {
            images[i].style.display = 'none';
        }
    }

    const selectedImageOption = document.querySelector(".image-option.selected");
    const selectedImgElement = selectedImageOption.querySelector("img");
    selectedImgElement.style.height = '500px';
    selectedImgElement.style.width = 'auto';
    selectedImgElement.style.objectFit = 'contain';

    document.getElementById('wiseWords').innerHTML = selectedImgElement.alt;
    document.getElementById('wiseWords').style.display = 'block';

    document.getElementsByTagName('button')[0].style.display = 'none';
    document.getElementsByTagName('button')[1].style.display = 'inline-block';

    setTimeout(() => { document.getElementById('wiseWords').style.opacity = '1'; }, 10);
}

function confirmChoice() {
    var container = document.getElementById('mainContainer');
    container.style.opacity = '0';
    //
    setTimeout(async function () {
        console.log("Choice confirmed:", selectedImage);
        await registerCardUsage_cycle("PictureSelection.html");
        const randomCard = await requestNextCard();
        if (randomCard) {
            console.log("Random card selected:", randomCard);
            window.location.href = `${randomCard}`;
        } else {
            console.log("No cards left, going to UrgeTest_final");
            window.location.href = '../pages/UrgeTest_final.html';
        }
    }, 1000);
}