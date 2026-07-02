// =======================================
// VisionHUD v0.4
// assistant.js
// =======================================

let assistantPanel;
let assistantQuestion;
let assistantResponse;
let assistantClose;
let assistantSend;
let assistantMic;

function initializeAssistant() {

    assistantPanel = document.getElementById("assistant-panel");
    assistantQuestion = document.getElementById("assistant-question");
    assistantResponse = document.getElementById("assistant-response");
    assistantClose = document.getElementById("assistant-close");
    assistantSend = document.getElementById("assistant-send");
    assistantMic = document.getElementById("assistant-mic");

    assistantClose.addEventListener("click", closeAssistant);

    assistantSend.addEventListener("click", async function(){

        const question = assistantQuestion.value.trim();

        if(question === "")
            return;

        await askAssistant(question);

    });

    assistantMic.addEventListener("click", startAssistantVoice);

}

function openAssistant(){

    assistantQuestion.value = "";

    assistantResponse.textContent =
`Bonjour.

Posez une question concernant ce que VisionHUD voit actuellement.`;

    assistantPanel.classList.add("open");

    assistantQuestion.focus();

}

function closeAssistant(){

    assistantPanel.classList.remove("open");

}

async function askAssistant(question){

    assistantResponse.textContent =
        "Analyse en cours...";

    try{

        const response =
            await askClaudeAssistant(question);

        assistantResponse.textContent =
            response;

        speakAssistant(response);

    }

    catch(error){

        console.error(error);

        assistantResponse.textContent =
            "Erreur : " + error.message;

    }

}

function startAssistantVoice(){

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if(!SpeechRecognition){

        assistantResponse.textContent =
            "La reconnaissance vocale n'est pas disponible.";

        return;

    }

    const recognition =
        new SpeechRecognition();

    recognition.lang = "fr-CA";

    recognition.continuous = false;

    recognition.interimResults = false;

    assistantResponse.textContent =
        "🎤 Écoute en cours...";

    recognition.onresult = async function(event){

        const question =
            event.results[0][0].transcript;

        assistantQuestion.value = question;

        await askAssistant(question);

    };

    recognition.onerror = function(event){

        assistantResponse.textContent =
            "Erreur de reconnaissance vocale : " + event.error;

    };

    recognition.start();

}

function speakAssistant(text){

    if(!("speechSynthesis" in window))
        return;

    speechSynthesis.cancel();

    const utter =
        new SpeechSynthesisUtterance(text);

    utter.lang = "fr-CA";

    utter.rate = 1.0;

    speechSynthesis.speak(utter);

}

console.log("assistant.js chargé");