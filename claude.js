// =======================================
// VisionHUD v0.4
// claude.js
// Module central Claude
// =======================================

async function callClaude(promptText, imageBase64 = null) {

    const key = window.apiKey || apiKey;

if (!key) {
    throw new Error("Aucune clé API.");
}

    const content = [];

    if (imageBase64) {

        content.push({
            type: "image",
            source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64
            }
        });

    }

    content.push({
        type: "text",
        text: promptText
    });

    const response = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true"
            },

            body: JSON.stringify({

                model: "claude-sonnet-4-6",

                max_tokens: 300,

                messages: [
                    {
                        role: "user",
                        content: content
                    }
                ]

            })

        }
    );

    if (!response.ok) {

        const error = await response.text();

        throw new Error(error);

    }

    const data = await response.json();

    const block =
        data.content.find(x => x.type === "text");

    if (!block)
        return "";

    return block.text;

}



// =============================
// Assistant VisionHUD
// =============================

async function askClaudeAssistant(question) {

    const history =
        sceneMemory
            .slice(0,5)
            .map(scene => scene.text)
            .join("\n\n");

    const contexteVisuel =
        history
            ? `Voici les cinq dernières observations visuelles (utilise-les uniquement si la question porte sur l'environnement) :\n\n${history}\n`
            : "Aucune observation visuelle récente.\n";

    const prompt =
`Tu es VisionHUD Assistant, un assistant vocal intelligent et polyvalent.

Tu peux répondre à N'IMPORTE QUEL type de question : culture générale, calculs, conversation, conseils, définitions, etc. Tu n'es pas limité aux questions sur l'environnement visuel.

${contexteVisuel}

Question :

${question}

Consignes :

Réponds en français.

Réponse claire et concise, maximum 150 mots.

Si la question porte spécifiquement sur ce que voit la caméra et que l'information ne se trouve pas dans les observations ci-dessus, dis-le clairement plutôt que d'inventer.

Pour toute autre question, réponds normalement avec tes connaissances générales, sans te limiter aux observations.`;

    return await callClaude(prompt);

}



// =============================
// Analyse VisionHUD
// =============================

async function analyzeImage(prompt, image) {

    return await callClaude(prompt, image);

}

console.log("claude.js chargé");