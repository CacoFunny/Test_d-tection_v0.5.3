// =======================================
// VisionHUD v0.5
// signs.js
// Module : Reconnaissance du langage des signes
// =======================================

const SIGNS_LANG_KEY = "visionhud_signs_lang";

const SIGNS_LANGUAGES = [
    { id: "LSQ",  label: "LSQ — Québec" },
    { id: "LSF",  label: "LSF — France" },
    { id: "ASL",  label: "ASL — Américain" },
    { id: "BSL",  label: "BSL — Britannique" },
    { id: "LIS",  label: "LIS — Italien" },
    { id: "DGS",  label: "DGS — Allemand" }
];

class SignsModule {

    constructor(){

        this.active        = false;
        this.captureTimer  = null;
        this.isAnalyzing   = false;
        this.lastResult    = "";
        this.captureFreqMs = 3000;
        this.signsLang     = localStorage.getItem(SIGNS_LANG_KEY) || "LSQ";

        this.ui = {};
        this._buildUI();

    }

    // ============ DÉMARRER / ARRÊTER ============

    start(){

        if(this.active) return;

        // Vérifie que la caméra VisionHUD est disponible
        const vid = document.getElementById("video");
        if(!vid || !vid.srcObject){
            this._setStatus("Caméra non active. Démarre d'abord le scan VisionHUD.");
            return;
        }

        this.active = true;
        this._setStatus("Scan des signes actif...");
        this.ui.toggleBtn.textContent  = "⏹ Arrêter";
        this.ui.toggleBtn.style.background = "#F0537A";
        this.ui.toggleBtn.style.color  = "#fff";
        this.ui.resultBox.textContent  = "";
        this.ui.lastWordBox.textContent = "";

        this._runCycle();
        this.captureTimer = setInterval(
            () => this._runCycle(),
            this.captureFreqMs
        );

    }

    stop(){

        this.active = false;

        if(this.captureTimer){
            clearInterval(this.captureTimer);
            this.captureTimer = null;
        }

        this._setStatus("Arrêté.");
        this.ui.toggleBtn.textContent  = "▶ Démarrer";
        this.ui.toggleBtn.style.background = "#5EEAD4";
        this.ui.toggleBtn.style.color  = "#06201C";

    }

    toggle(){

        if(this.active){ this.stop(); } else { this.start(); }

    }

    // ============ CYCLE D'ANALYSE ============

    async _runCycle(){

        if(this.isAnalyzing) return;

        const frame = this._captureFrame();
        if(!frame) return;

        this.isAnalyzing = true;
        this._setStatus("Analyse en cours...");

        try {

            const result = await this._analyzeSign(frame);
            this._handleResult(result);

        } catch(err){

            this._setStatus("Erreur : " + err.message.slice(0, 60));

        } finally {

            this.isAnalyzing = false;

        }

    }

    // ============ CAPTURE D'IMAGE ============

    _captureFrame(){

        const vid = document.getElementById("video");
        const cnv = document.getElementById("canvas");

        if(!vid || !cnv || !vid.videoWidth) return null;

        // Résolution plus haute pour mieux voir les doigts/mains
        const scale = Math.min(1, 800 / Math.max(vid.videoWidth, vid.videoHeight));
        cnv.width  = Math.round(vid.videoWidth  * scale);
        cnv.height = Math.round(vid.videoHeight * scale);

        const ctx = cnv.getContext("2d");
        ctx.drawImage(vid, 0, 0, cnv.width, cnv.height);

        return cnv.toDataURL("image/jpeg", 0.82).split(",")[1];

    }

    // ============ APPEL API CLAUDE ============

    async _analyzeSign(base64Image){

        const key = window.apiKey || (typeof apiKey !== "undefined" ? apiKey : null);

        if(!key) throw new Error("Aucune clé API configurée.");

        const langLabel = SIGNS_LANGUAGES.find(l => l.id === this.signsLang)?.label
                          || this.signsLang;

        const prompt =
`Tu es un système spécialisé dans la reconnaissance du langage des signes.

Analyse attentivement cette image.

Langage des signes à interpréter : ${langLabel}.

Consignes :

1. Si tu vois clairement des mains en train de former un ou plusieurs signes, identifie et traduis ce qui est signé. Sois conservateur — si tu n'es pas certain, dis-le clairement plutôt qu'inventer.

2. Indique le niveau de confiance : CERTAIN, PROBABLE, ou INCERTAIN.

3. Si aucune main n'est visible ou si la position des mains ne correspond à aucun signe reconnaissable, réponds uniquement :
RIEN: aucun signe détecté

4. Si une main est visible mais le signe est flou ou coupé, réponds :
INCERTAIN: [description de ce que tu vois partiellement]

Format attendu pour un signe reconnu :
SIGNE: [mot ou phrase interprétée] | CONFIANCE: [CERTAIN / PROBABLE / INCERTAIN]

Maximum 2 lignes (si plusieurs signes enchaînés visibles).
Réponds uniquement avec le format ci-dessus, sans introduction ni explication supplémentaire.`;

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
                    max_tokens: 120,
                    messages: [{
                        role: "user",
                        content: [
                            {
                                type: "image",
                                source: {
                                    type: "base64",
                                    media_type: "image/jpeg",
                                    data: base64Image
                                }
                            },
                            { type: "text", text: prompt }
                        ]
                    }]
                })
            }
        );

        if(!response.ok){
            const err = await response.text();
            throw new Error(response.status + " " + err.slice(0, 60));
        }

        const data   = await response.json();
        const block  = data.content.find(b => b.type === "text");
        return block ? block.text.trim() : "";

    }

    // ============ TRAITEMENT DU RÉSULTAT ============

    _handleResult(rawText){

        if(!rawText || rawText.startsWith("RIEN:") || rawText === ""){
            this._setStatus("En attente de signes...");
            return;
        }

        // Évite de répéter le même résultat
        if(rawText === this.lastResult){
            this._setStatus("Signe maintenu — en attente...");
            return;
        }

        this.lastResult = rawText;

        // Parse le format : SIGNE: xxx | CONFIANCE: yyy
        const lines = rawText.split("\n").filter(Boolean);

        let allSigns = [];

        for(const line of lines){

            if(line.startsWith("INCERTAIN:")){
                const desc = line.replace("INCERTAIN:", "").trim();
                this._setStatus("Signe partiel : " + desc);
                continue;
            }

            const m = line.match(/SIGNE:\s*(.+?)\s*\|\s*CONFIANCE:\s*(.+)/i);

            if(m){
                const mot       = m[1].trim();
                const confiance = m[2].trim().toUpperCase();
                const icon      = confiance === "CERTAIN"  ? "✅"
                                : confiance === "PROBABLE" ? "🟡"
                                : "⚠";
                allSigns.push({ mot, confiance, icon });
            }

        }

        if(allSigns.length === 0) return;

        // Affichage textuel dans le panneau
        const signsText = allSigns
            .map(s => `${s.icon} ${s.mot} (${s.confiance})`)
            .join("\n");

        this.ui.resultBox.textContent = signsText;

        // Affiche le dernier mot détecté en grand dans le tag HUD
        const dernierMot = allSigns[allSigns.length - 1].mot;
        this.ui.lastWordBox.textContent = dernierMot;

        this._setStatus("Signe reconnu");

        // Lecture vocale via SpeechSynthesis
        this._speak(dernierMot);

        // Affiche aussi un tag HUD dans la couche VisionHUD si disponible
        if(typeof showTag === "function"){
            const confiance = allSigns[0].confiance;
            const catClass  = confiance === "CERTAIN" ? "social" : "contextuel";
            showTag("🤟", dernierMot + " (" + confiance + ")", catClass, false);
        }

    }

    // ============ SYNTHÈSE VOCALE ============

    _speak(text){

        if(!("speechSynthesis" in window)) return;

        // Annule toute lecture en cours pour ne pas s'empiler
        speechSynthesis.cancel();

        const utter  = new SpeechSynthesisUtterance(text);
        utter.lang   = "fr-CA";
        utter.rate   = 1.0;
        utter.volume = 1.0;

        speechSynthesis.speak(utter);

    }

    // ============ INTERFACE ============

    _buildUI(){

        if(document.getElementById("signs-module-styles")) return;

        // CSS
        const style = document.createElement("style");
        style.id = "signs-module-styles";
        style.textContent = `
            #signs-btn {
                position: fixed;
                bottom: 156px;
                right: 16px;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: rgba(20,20,20,0.88);
                color: #fff;
                border: 1px solid rgba(255,255,255,0.2);
                font-size: 20px;
                z-index: 9998;
                cursor: pointer;
            }
            #signs-panel {
                position: fixed;
                bottom: 216px;
                right: 16px;
                width: 270px;
                background: rgba(12,12,20,0.97);
                border: 1px solid #2D7A6E;
                border-radius: 14px;
                padding: 14px;
                color: #E6EDF3;
                font-family: 'JetBrains Mono', monospace;
                font-size: 13px;
                z-index: 9998;
                display: none;
            }
            #signs-panel.open { display: block; }
            #signs-panel h3 {
                margin: 0 0 10px;
                font-size: 13px;
                color: #5EEAD4;
                letter-spacing: 0.06em;
                text-transform: uppercase;
            }
            #signs-status {
                font-size: 11px;
                color: #64748B;
                margin-bottom: 8px;
                min-height: 16px;
            }
            #signs-last-word {
                font-size: 22px;
                font-weight: 700;
                color: #5EEAD4;
                min-height: 30px;
                margin-bottom: 6px;
                letter-spacing: 0.02em;
            }
            #signs-result-box {
                font-size: 12px;
                color: #E6EDF3;
                background: #0A0E14;
                border: 1px solid #1E2530;
                border-radius: 8px;
                padding: 8px 10px;
                min-height: 40px;
                white-space: pre-wrap;
                margin-bottom: 10px;
            }
            #signs-lang-select {
                width: 100%;
                background: #0A0E14;
                color: #E6EDF3;
                border: 1px solid #1E2530;
                border-radius: 6px;
                padding: 7px 8px;
                font-family: inherit;
                font-size: 12px;
                margin-bottom: 10px;
            }
            #signs-toggle-btn {
                width: 100%;
                background: #5EEAD4;
                color: #06201C;
                border: none;
                border-radius: 10px;
                padding: 11px;
                font-family: inherit;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                letter-spacing: 0.03em;
            }
            #signs-freq-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 11px;
                color: #64748B;
            }
            #signs-freq-select {
                background: #0A0E14;
                color: #E6EDF3;
                border: 1px solid #1E2530;
                border-radius: 6px;
                padding: 4px 6px;
                font-size: 11px;
                font-family: inherit;
            }
            #signs-note {
                font-size: 10px;
                color: #64748B;
                margin-top: 8px;
                line-height: 1.5;
            }
        `;
        document.head.appendChild(style);

        // Bouton flottant
        const btn = document.createElement("button");
        btn.id = "signs-btn";
        btn.title = "Langage des signes";
        btn.textContent = "🤟";
        document.body.appendChild(btn);

        // Panneau
        const panel = document.createElement("div");
        panel.id = "signs-panel";

        // Sélecteur de langue
        const langOptions = SIGNS_LANGUAGES
            .map(l => `<option value="${l.id}"${l.id === this.signsLang ? " selected" : ""}>${l.label}</option>`)
            .join("");

        // Sélecteur de fréquence
        const freqOptions = [
            { val: 2000, label: "2s" },
            { val: 3000, label: "3s" },
            { val: 4000, label: "4s" }
        ].map(f => `<option value="${f.val}"${f.val === this.captureFreqMs ? " selected" : ""}>${f.label}</option>`).join("");

        panel.innerHTML = `
            <h3>🤟 Langage des signes</h3>
            <div id="signs-status">Inactif</div>
            <div id="signs-last-word"></div>
            <div id="signs-result-box">En attente...</div>
            <select id="signs-lang-select">${langOptions}</select>
            <div id="signs-freq-row">
                <span>Fréquence de scan</span>
                <select id="signs-freq-select">${freqOptions}</select>
            </div>
            <button id="signs-toggle-btn">▶ Démarrer</button>
            <div id="signs-note">
                ⚠ Le modèle reconnaît les signes courants.<br>
                Tiens tes mains bien visibles face à la caméra.<br>
                ✅ = certain · 🟡 = probable · ⚠ = incertain
            </div>
        `;
        document.body.appendChild(panel);

        // Récupération des éléments UI
        this.ui = {
            btn,
            panel,
            statusEl:    panel.querySelector("#signs-status"),
            lastWordBox: panel.querySelector("#signs-last-word"),
            resultBox:   panel.querySelector("#signs-result-box"),
            langSelect:  panel.querySelector("#signs-lang-select"),
            freqSelect:  panel.querySelector("#signs-freq-select"),
            toggleBtn:   panel.querySelector("#signs-toggle-btn")
        };

        // Événements
        btn.addEventListener("click", () => panel.classList.toggle("open"));

        this.ui.toggleBtn.addEventListener("click", () => this.toggle());

        this.ui.langSelect.addEventListener("change", (e) => {
            this.signsLang = e.target.value;
            localStorage.setItem(SIGNS_LANG_KEY, this.signsLang);
        });

        this.ui.freqSelect.addEventListener("change", (e) => {
            this.captureFreqMs = parseInt(e.target.value, 10);
            // Redémarre la boucle avec la nouvelle fréquence si actif
            if(this.active){
                clearInterval(this.captureTimer);
                this.captureTimer = setInterval(
                    () => this._runCycle(),
                    this.captureFreqMs
                );
            }
        });

    }

    _setStatus(text){
        if(this.ui.statusEl) this.ui.statusEl.textContent = text;
    }

}

// ============ INITIALISATION GLOBALE ============

let signsModule = null;

function initializeSignsModule(){
    if(!signsModule){
        signsModule = new SignsModule();
    }
}

console.log("signs.js chargé");
