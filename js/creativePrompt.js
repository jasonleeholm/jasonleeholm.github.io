let adjectives = [];
let nouns = [];

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

    document.getElementById("creativePrompt").innerHTML =
        `Come up with an idea using <strong>${articleFor(adjective)} ${adjective} ${noun}</strong> as the subject of inspiration.
        Interpret the prompt however you choose. Use any creative domain, medium, method, style, technique, or tool you want!`;

}

document.addEventListener("DOMContentLoaded", () => {

    loadWordLists();

    document.getElementById("newPromptBtn")
        .addEventListener("click", generatePrompt);

});
