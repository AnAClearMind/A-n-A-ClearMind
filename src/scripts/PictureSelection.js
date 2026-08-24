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
    document.getElementById('confirmChoiceButton').addEventListener('click', function () {
        UpdateProgressionAndProceed(() => completeCurrentCardAndProceed("PictureSelection.html"));
    });
};

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
            let excludeList = Array.isArray(result.SlidesDataVar_PictureSelection) ? result.SlidesDataVar_PictureSelection : [];

            if (totalPictureCount <= 3 || excludeList.length > totalPictureCount - 3) {
                excludeList = [];
            }

            for (let i = 0; i < 3; i++) {
                let availableIndices = [];
                for (let idx = 0; idx < totalPictureCount; idx++) {
                    if (!excludeList.includes(idx)) {
                        availableIndices.push(idx);
                    }
                }

                if (availableIndices.length === 0) {
                    excludeList = [];
                    for (let idx = 0; idx < totalPictureCount; idx++) {
                        availableIndices.push(idx);
                    }
                }

                const randomSlot = Math.floor(Math.random() * availableIndices.length);
                const selectedIndex = availableIndices[randomSlot];

                const imgElement = document.getElementById(`pictureSelection_img${i}`);
                if (imgElement && pictureSelectionContent[selectedIndex]) {
                    imgElement.src = pictureSelectionContent[selectedIndex].image;
                    imgElement.alt = pictureSelectionContent[selectedIndex].desc;
                }

                excludeList.push(selectedIndex);
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

    setSafeHTML(document.getElementById('wiseWords'), selectedImgElement.alt);
    document.getElementById('wiseWords').style.display = 'block';

    document.getElementsByTagName('button')[0].style.display = 'none';
    document.getElementsByTagName('button')[1].style.display = 'inline-block';

    setTimeout(() => { document.getElementById('wiseWords').style.opacity = '1'; }, 10);
}
