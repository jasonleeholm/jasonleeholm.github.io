let adjectives = [];
let nouns = [];
let currentPrompt = "";

async function loadWordLists() {

    try {

        const adjectiveResponse = await fetch("data/adjectives.txt");
        const nounResponse = await fetch("data/nouns.txt");

        adjectives = (await adjectiveResponse.text())
            .split(/\r?\n/)
            .map(word => word.trim())
            .filter(word => word.length);

        nouns = (await nounResponse.text())
            .split(/\r?\n/)
            .map(word => word.trim())
            .filter(word => word.length);

        generatePrompt();

    }
    catch (error) {

        document.getElementById("creativePrompt").textContent =
            "Unable to load prompt data.";

        console.error(error);

    }

}

function randomItem(array) {

    return array[Math.floor(Math.random() * array.length)];

}

function articleFor(word) {

    return /^[aeiou]/i.test(word) ? "an" : "a";

}

function generatePrompt() {

    const adjective = randomItem(adjectives);
    const noun = randomItem(nouns);

    currentPrompt = `Your Creative Prompt: Come up with an idea using ${articleFor(adjective)} ${adjective} ${noun} as the subject of inspiration. Interpret the prompt however you choose. Use any creative domain, medium, method, style, technique, or tool you want!`;

    document.getElementById("creativePrompt").innerHTML =
        `<p>Come up with an idea using<br/>
        <strong>${articleFor(adjective)} ${adjective} ${noun}</strong><br/>
        as the subject of inspiration.</p><br/>
        <p>Interpret the prompt however you choose.</p><br/>
        <p>Use any creative<br/>
        <strong>domain, medium, method, style, technique, or tool</strong><br/>
        you want!</p>`;

}

async function copyPrompt() {

    try {
        await navigator.clipboard.writeText(currentPrompt);
        const button = document.getElementById("copyPromptBtn");
        button.textContent = "Copied!";
        setTimeout(() => {
            button.textContent = "Copy Prompt";
        }, 1500);
    }
    catch (err) {
        console.error(err);
        alert("Unable to copy prompt.");
    }
}

document.addEventListener("DOMContentLoaded", () => {

    loadWordLists();

    document.getElementById("copyPromptBtn")
    .addEventListener("click", copyPrompt);
    
    document.getElementById("newPromptBtn")
        .addEventListener("click", generatePrompt);

});
