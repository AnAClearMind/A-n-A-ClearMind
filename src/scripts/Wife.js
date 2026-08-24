document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    dataLoadFromBase(data.Wife);
    UpdateFooterState();
});

window.onload = async function () {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('confirmDescriptionButton').addEventListener('click', function () {
        UpdateProgressionAndProceed(() => completeCurrentCardAndProceed("Wife.html"));
    });
};

function dataLoadFromBase(Wife) {
    const h1 = document.querySelector('h1');
    const wifeDescription = document.getElementById('wifeDescription');
    const confirmDescriptionButton = document.getElementById('confirmDescriptionButton');

    h1.textContent = Wife.static.h1;
    wifeDescription.placeholder = Wife.static.wifeDescription;
    confirmDescriptionButton.textContent = Wife.static.confirmDescriptionButton;
}
