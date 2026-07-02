// =======================================
// VisionHUD v0.3
// translation.js
// =======================================

const TRANSLATE_SOURCE_KEY = "visionhud_translate_source_lang";
const TRANSLATE_TARGET_KEY = "visionhud_translate_target_lang";

let translateSourceLang =
    localStorage.getItem(TRANSLATE_SOURCE_KEY) || "auto";

let translateTargetLang =
    localStorage.getItem(TRANSLATE_TARGET_KEY) || "français";

const LANGUAGES = [

    { id: "auto", label: "Auto" },
    { id: "français", label: "Français" },
    { id: "anglais", label: "Anglais" },
    { id: "espagnol", label: "Espagnol" },
    { id: "allemand", label: "Allemand" },
    { id: "italien", label: "Italien" },
    { id: "portugais", label: "Portugais" },
    { id: "japonais", label: "Japonais" },
    { id: "chinois", label: "Chinois" },
    { id: "arabe", label: "Arabe" }

];

function setTranslateSource(lang){

    translateSourceLang = lang;

    localStorage.setItem(
        TRANSLATE_SOURCE_KEY,
        lang
    );

}

function setTranslateTarget(lang){

    translateTargetLang = lang;

    localStorage.setItem(
        TRANSLATE_TARGET_KEY,
        lang
    );

}

function saveTranslateSettings(){

    if(!translateSourceSelect) return;

    setTranslateSource(
        translateSourceSelect.value
    );

    setTranslateTarget(
        translateTargetSelect.value
    );

}

function populateLanguageSelectors(){

    if(
        !translateSourceSelect ||
        !translateTargetSelect
    ) return;

    translateSourceSelect.innerHTML = "";

    translateTargetSelect.innerHTML = "";

    LANGUAGES.forEach(language=>{

        const source =
            document.createElement("option");

        source.value = language.id;

        source.textContent = language.label;

        translateSourceSelect.appendChild(source);

        if(language.id !== "auto"){

            const target =
                document.createElement("option");

            target.value = language.id;

            target.textContent = language.label;

            translateTargetSelect.appendChild(target);

        }

    });

}

function buildTranslatePrompt(){

    const sourceInstruction =
        translateSourceLang==="auto"

        ? "Détecte automatiquement la langue source."

        : `La langue source est ${translateSourceLang}.`;

    return `
Tu es un système VisionHUD spécialisé en traduction.

Analyse toute l'image.

Détecte tous les textes visibles.

${sourceInstruction}

Traduis chaque texte en ${translateTargetLang}.

Maximum trois lignes.

Si aucun texte :

RIEN: aucun texte détecté.
`;

}

console.log("translation.js chargé");