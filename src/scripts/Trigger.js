document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    dataLoadFromBase(data.Trigger);
    UpdateFooterState();
});

window.onload = async function () {
    document.getElementById('mainContainer').style.opacity = '1';
    document.getElementById('triggerButton').addEventListener('click', function () {
        const trigger = document.getElementById("triggerDescription")?.value;
        if (trigger) {
            console.log("Trigger identified: " + trigger);
        }
        UpdateProgressionAndProceed(() => completeCurrentCardAndProceed("Trigger.html"));
    });
};

function dataLoadFromBase(Trigger) {
    const h1 = document.querySelector('h1');
    const p = document.querySelector('p');
    const triggerDescription = document.getElementById('triggerDescription');
    const triggerButton = document.getElementById('triggerButton');

    h1.textContent = Trigger.static.h1;
    p.textContent = Trigger.static.p;
    triggerDescription.placeholder = Trigger.static.triggerDescription;
    triggerButton.textContent = Trigger.static.triggerButton;
}

