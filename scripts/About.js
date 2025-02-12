
document.addEventListener('DOMContentLoaded', async () => {
    const data = await getDB();
    SetupDynamicDataFromDB(data.Sys_links);
    dataLoadFromBase(data.About);
	setTimeout(function() {loadOperaAlert(data.About.static.OperaAlert); }, 500);
});

window.onload = async function () {
    document.getElementById('mainContainer').style.opacity = '1';
    const languageSelect = document.getElementById("languageSelect");
    chrome.storage.local.get("sys_language", function (result) {
        if (result.sys_language) {
            languageSelect.value = result.sys_language;
        }
        updateFlag();
    });
    languageSelect.addEventListener("change", () => changeLanguage(languageSelect));
    //
    const themeSelect = document.getElementById("themeSelect");
    chrome.storage.local.get("sys_theme", function (result) {
        if (result.sys_theme) {
            themeSelect.value = result.sys_theme;
        }
    });
    themeSelect.addEventListener("change", () => changeTheme(themeSelect));
    //
    [1, 2, 3].forEach((index) => {
        document.getElementById(`openTab${index}`).addEventListener('click', () => openTab(index));
        document.getElementById(`saveUserContentButton${index}`).addEventListener('click', () => saveUserContent(index));
        document.getElementById(`deleteUserContentButton${index}`).addEventListener('click', () => deleteUserContent(index));
        document.getElementById(`imageFile${index}`).addEventListener('change', () => previewImage(index));
    });
    //
    document.getElementById('exportBlocklistButton').addEventListener('click', exportBlocklist);
    document.getElementById('importBlocklistButton').addEventListener('click', importBlocklist);
    //
    loadUserContentFromStorage();
    openTab(1);
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

async function changeLanguage(languageSelect) {
    chrome.storage.local.set({ "sys_language": languageSelect.value }, function () {
        chrome.runtime.sendMessage({ action: 'loadData' }, (response) => {
            if (response.status === 'success') {
            } else {
                console.error('Error loading data:', response.message);
            }
        });
        //
        location.reload();
    });
}

async function changeTheme(themeSelected) {
    chrome.storage.local.set({ sys_theme: themeSelected.value }, () => {
        location.reload();
    });
}

function updateFlag() {
    const selectedOption = languageSelect.options[languageSelect.selectedIndex];
    const flagUrl = selectedOption.getAttribute("data-flag");
    const flagImage = document.createElement("img");
    flagImage.src = flagUrl;
    flagImage.alt = selectedOption.text;
    const languageContainer = document.querySelector(".language-container");
    const existingFlag = languageContainer.querySelector("img");
    if (existingFlag) {
        existingFlag.replaceWith(flagImage);
    } else {
        languageContainer.insertBefore(flagImage, languageSelect);
    }
}


function SetupDynamicDataFromDB(Sys_links) {
    const link_support = Sys_links.support;
    const link_contact = Sys_links.contact;
    const link_source = Sys_links.source;
    document.getElementById('sourceButton').addEventListener('click', function () { openWebpage(link_source); });
    document.getElementById('contactButton').addEventListener('click', function () { openWebpage(link_contact); });
    document.getElementById('supportButton').addEventListener('click', function () { openWebpage(link_support); });
}

function openWebpage(url) {
    window.open(url, '_blank');
}

function saveUserContent(index) {
    const fileInput = document.getElementById(`imageFile${index}`);
    const file = fileInput.files[0];
    const userText = document.getElementById(`userText${index}`).value;
    const maxSizeInBytes = 2 * 1024 * 1024;

    chrome.storage.local.get('userSlides', (result) => {
        const slides = result.userSlides || [{}, {}, {}]; // Initialize if undefined
        const currentSlide = slides[index - 1];

        if (file && file.size > maxSizeInBytes) {
            alert('Please, do not use image files above 2mb');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            const fileContent = event.target.result;
            slides[index - 1] = { text: userText, image: fileContent };
            chrome.storage.local.set({ userSlides: slides }, () => {
                console.log(`Slide ${index} saved to extension storage.`);
            });
        };

        if (file) {
            reader.readAsDataURL(file);
        } else {
            slides[index - 1] = { text: userText, image: currentSlide.image };
            chrome.storage.local.set({ userSlides: slides }, () => {
                console.log(`Slide ${index} saved to extension storage.`);
            });
        }
    });
}

function loadUserContentFromStorage() {
    chrome.storage.local.get('userSlides', (result) => {
        const slides = result.userSlides || [{}, {}, {}];
        slides.forEach((slide, index) => {
            if (slide) {
                document.getElementById(`userText${index + 1}`).value = slide.text || '';
                const imgElement = document.getElementById(`imagePreview${index + 1}`);
                imgElement.src = slide.image || '';
                imgElement.style.display = slide.image ? 'block' : 'none';
            }
        });
    });
}

function deleteUserContent(index) {
    chrome.storage.local.get('userSlides', (result) => {
        const slides = result.userSlides || [{}, {}, {}];
        slides[index - 1] = {}; // Clear the slide content
        chrome.storage.local.set({ userSlides: slides }, () => {
            console.log(`Slide ${index} deleted from storage.`);
            document.getElementById(`userText${index}`).value = '';
            const imgElement = document.getElementById(`imagePreview${index}`);
            imgElement.src = '';
            imgElement.style.display = 'none';
        });
    });
}

function openTab(tabIndex) {
    const sections = document.querySelectorAll('.user-input-section');
    const tabs = document.querySelectorAll('.tab');
    sections.forEach((section, index) => {
        section.style.display = index + 1 === tabIndex ? 'block' : 'none';
        tabs[index].classList.toggle('active', index + 1 === tabIndex);
    });
}

function previewImage(index) {
    const fileInput = document.getElementById(`imageFile${index}`);
    const preview = document.getElementById(`imagePreview${index}`);
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onloadend = function () {
        preview.src = reader.result;
        preview.style.display = 'block';
    };

    if (file) {
        reader.readAsDataURL(file);
    } else {
        preview.src = "";
        preview.style.display = 'none';
    }
}

function dataLoadFromBase(About) {
    const h1 = document.getElementById('h1text');
    const h2About = document.getElementById('h2About');
    const p1 = document.getElementById('p1');
    const p3 = document.getElementById('p3');
    const p4 = document.getElementById('p4');
    const sourceButton = document.getElementById('sourceButton').querySelector('span');
    const contactButton = document.getElementById('contactButton').querySelector('span');
    const supportButton = document.getElementById('supportButton').querySelector('span');
    const OwnPage = document.getElementById('OwnPage');
    const p5 = document.getElementById('p5');
    const openTab1 = document.getElementById('openTab1').querySelector('b');
    const openTab2 = document.getElementById('openTab2').querySelector('b');
    const openTab3 = document.getElementById('openTab3').querySelector('b');
    const deleteUserContentButton1 = document.getElementById('deleteUserContentButton1').querySelector('span');
    const saveUserContentButton1 = document.getElementById('saveUserContentButton1').querySelector('span');
    const deleteUserContentButton2 = document.getElementById('deleteUserContentButton2').querySelector('span');
    const saveUserContentButton2 = document.getElementById('saveUserContentButton2').querySelector('span');
    const deleteUserContentButton3 = document.getElementById('deleteUserContentButton3').querySelector('span');
    const saveUserContentButton3 = document.getElementById('saveUserContentButton3').querySelector('span');
    const languageSelectLabel = document.getElementById('languageSelectLabel');
    const themeSelectLabel = document.getElementById('themeSelectLabel');
    const themeLabelLight = document.getElementById('themeLabelLight');
    const themeLabelDark = document.getElementById('themeLabelDark');
	const OwnBlocklist = document.getElementById('OwnBlocklist');
	const ownblocknotice = document.getElementById('ownblocknotice');
	const exportBlocklistButton = document.getElementById('exportBlocklistButton').querySelector('span');
	const importBlocklistButton = document.getElementById('importBlocklistButton').querySelector('span');

    h1.textContent = About.static.h1;
    h2About.textContent = About.static.h2About;
    p1.innerHTML = About.static.p1;
    p3.textContent = About.static.p3;
    p4.textContent = About.static.p4;
    sourceButton.textContent = About.static.sourceButton;
    contactButton.textContent = About.static.contactButton;
    supportButton.textContent = About.static.supportButton;
    OwnPage.textContent = About.static.OwnPage;
    p5.textContent = About.static.p5;
    openTab1.textContent = About.static.openTab1;
    openTab2.textContent = About.static.openTab2;
    openTab3.textContent = About.static.openTab3;
    deleteUserContentButton1.textContent = About.static.deleteUserContentButton;
    saveUserContentButton1.textContent = About.static.saveUserContentButton;
    deleteUserContentButton2.textContent = About.static.deleteUserContentButton;
    saveUserContentButton2.textContent = About.static.saveUserContentButton;
    deleteUserContentButton3.textContent = About.static.deleteUserContentButton;
    saveUserContentButton3.textContent = About.static.saveUserContentButton;
    languageSelectLabel.textContent = About.static.languageSelectLabel;
    themeSelectLabel.textContent = About.static.themeSelectLabel;
    themeLabelLight.textContent = About.static.themeLabelLight;
    themeLabelDark.textContent = About.static.themeLabelDark;
	OwnBlocklist.textContent = About.static.OwnBlocklist;
	ownblocknotice.innerHTML = About.static.ownblocknotice;
	exportBlocklistButton.textContent = About.static.exportBlocklistButton;
	importBlocklistButton.textContent = About.static.importBlocklistButton;
}

function loadOperaAlert(Message) {
	const urlParams = new URLSearchParams(window.location.search);
    let isNewInstall = urlParams.get('isNewInstall') === 'true' && !localStorage.getItem('alertShown');
    
    // Only show alert if it's Opera AND a new installation
    if (isNewInstall && (navigator.userAgent.indexOf("OPR") > -1 || navigator.userAgent.indexOf("Opera") > -1)) {
        alert(Message);
        
        // Set isNewInstall to false within the current function call
        isNewInstall = false;
        
        // Store a flag to indicate that the alert has been shown
        localStorage.setItem('alertShown', 'true');
    }
}

// Function to export blocklist
async function exportBlocklist() {
    chrome.storage.local.get('customBlockedDomains', function(result) {
        let domains = result.customBlockedDomains || [];
        let formatString = "# Format: domainName.domainZone, e.g. site.com, 1 per line.";
        let text = formatString + '\n' + domains.join('\n');
        let filename = "customBlockedDomains.txt";
        let blob = new Blob([text], { type: 'text/plain' });
        let downloadLink = URL.createObjectURL(blob);

        let a = document.createElement('a');
        a.href = downloadLink;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadLink);
    });
}

// Function to import blocklist
async function importBlocklist() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt'; // Accept only .txt files

    input.onchange = async function(event) {
        const file = event.target.files[0];

        if (!file) {
            alert("No file selected.");
            console.log("No file selected.");
            return;
        }

        if (file.type !== 'text/plain') {
            alert("Please select a .txt file.");
            return;
        }

        const reader = new FileReader();

        reader.onload = async function(event) {
            const fileContent = event.target.result;
            const lines = fileContent.split('\n');
            const domainsToAdd = [];

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine && !trimmedLine.startsWith('#')) { // Ignore empty lines and comments
                    domainsToAdd.push(trimmedLine);
                }
            }

            if (domainsToAdd.length === 0) {
                alert("No domains to add found in the file.");
                return;
            }

            if (domainsToAdd.length > 100) {
                alert("Import limit exceeded.\n\nDue to technical limitations, you can import a maximum of 100 custom blocks.\n\nPlease reduce the number of entries in your file and try again.");
                return; // Stop import if limit exceeded
            }

            let importSuccess = true; // Flag to track overall import success
            let importErrors = [];
            let successfulImports = 0;

            for (const domain of domainsToAdd) {
                await new Promise(resolve => { // Use promise to wait for each sendMessage response
                    chrome.runtime.sendMessage({ action: "addDomain", domain: domain }, function (response) {
                        if (response && response.success) {
                            console.log(`Domain "${domain}" added successfully: ${response.message}`);
                            successfulImports++;
                        } else {
                            importSuccess = false;
                            let errorMessage = `Domain "${domain}": `;
                            if (response && response.error) {
                                errorMessage += `${response.error}`;
                                if (response.message) { // Include "type" text if available
                                    errorMessage += ` (Type: ${response.message})`;
                                }
                            } else {
                                errorMessage += 'Unknown error';
                            }
                            importErrors.push(errorMessage);
                            console.log(`Error adding domain "${domain}": ${response ? response.error : 'Unknown error'}`, response);
                        }
                        resolve(); // Resolve promise to move to the next domain
                    });
                });
            }

            let message = "";
            if (importSuccess) {
                message = `Successfully imported ${successfulImports} domains.`;
            } else {
                message = `Import completed with errors.\n\n`;
                message += `Successfully imported ${successfulImports} out of ${domainsToAdd.length} domains.\n\n`;
                if (importErrors.length > 0) {
                    message += `Errors encountered:\n`;
                    importErrors.forEach(error => {
                        message += `- ${error}\n`;
                    });
                    console.log("Import errors:", importErrors.join("\n")); // Log detailed errors in console
                } else {
                    message += `Unknown errors during import.`; // In case importSuccess is false but no errors are collected.
                }
            }
            alert(message);
        };

        reader.onerror = function(event) {
            alert("Error reading the file.");
            console.log("Error reading file:", event);
        };

        reader.readAsText(file);
    };

    input.click(); // Programmatically open file selection dialog
}
