document.addEventListener('DOMContentLoaded', async () => {
	const data = await getDB();
	dataLoadFromBase(data.ImagineWords);
	UpdateFooterState();
});

window.onload = async function () {
	document.getElementById('mainContainer').style.opacity = '1';
	document.getElementById('wordsButton').addEventListener('click', function () {
		UpdateProgressionAndProceed(() => completeCurrentCardAndProceed("ImagineWords.html"));
	});
};

function dataLoadFromBase(ImagineWords) {
	const p = document.querySelector('p');
	const wordsDescription = document.getElementById('wordsDescription');
	const wordsButton = document.getElementById('wordsButton');

	setSafeHTML(p, ImagineWords.static.p);
	wordsDescription.placeholder = ImagineWords.static.wordsDescription;
	setSafeHTML(wordsButton, ImagineWords.static.wordsButton);
}
