// =======================================
// VisionHUD v0.4
// audio.js
// Module Audio : amplification, détection de sons, sous-titres
// =======================================

let audioModule = null;

class AudioModule {

    constructor(){

        this.audioContext = null;
        this.micStream = null;
        this.sourceNode = null;
        this.analyserNode = null;

        this.gainNode = null;
        this.compressorNode = null;

        this.amplifyActive = false;
        this.detectActive = false;
        this.subtitlesActive = false;

        this.amplifyGain = 2.5;

        this.detectionLoopId = null;
        this.recognition = null;
        this.lastAlertTime = 0;

        this.ui = {};

        this._buildUI();

    }

    // ============ INITIALISATION ============

    initialize(){

        this._buildUI();

    }

    // ============ ACCÈS MICRO PARTAGÉ ============

    async _ensureMicAccess(){

        if(this.micStream) return;

        this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        this.audioContext =
            this.audioContext ||
            new (window.AudioContext || window.webkitAudioContext)();

        this.sourceNode =
            this.audioContext.createMediaStreamSource(this.micStream);

        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 2048;
        this.sourceNode.connect(this.analyserNode);

    }

    // ============ AMPLIFICATION DU SON AMBIANT ============

    async amplify(active){

        const target =
            (typeof active === "boolean") ? active : !this.amplifyActive;

        if(target){

            await this._ensureMicAccess();

            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = this.amplifyGain;

            // Compresseur pour éviter la saturation et limiter le risque de larsen
            this.compressorNode = this.audioContext.createDynamicsCompressor();
            this.compressorNode.threshold.value = -18;
            this.compressorNode.knee.value = 20;
            this.compressorNode.ratio.value = 8;
            this.compressorNode.attack.value = 0.003;
            this.compressorNode.release.value = 0.15;

            this.sourceNode
                .connect(this.gainNode)
                .connect(this.compressorNode)
                .connect(this.audioContext.destination);

            this.amplifyActive = true;

            this._setStatus("amplify", "Actif — utilisez des écouteurs pour éviter le larsen");

        } else {

            if(this.gainNode) this.gainNode.disconnect();
            if(this.compressorNode) this.compressorNode.disconnect();

            this.amplifyActive = false;

            this._setStatus("amplify", "Inactif");

        }

        this._updateToggleUI("amplify", this.amplifyActive);

    }

    setAmplifyGain(value){

        this.amplifyGain = value;

        if(this.gainNode){
            this.gainNode.gain.value = value;
        }

    }

    // ============ DÉTECTION DE SONS IMPORTANTS ============

    async detectSound(active){

        const target =
            (typeof active === "boolean") ? active : !this.detectActive;

        if(target){

            await this._ensureMicAccess();

            this.detectActive = true;

            this._setStatus("detect", "Surveillance active");

            this._runDetectionLoop();

        } else {

            this.detectActive = false;

            if(this.detectionLoopId){
                cancelAnimationFrame(this.detectionLoopId);
                this.detectionLoopId = null;
            }

            this._setStatus("detect", "Inactif");

        }

        this._updateToggleUI("detect", this.detectActive);

    }

    _runDetectionLoop(){

        const bufferLength = this.analyserNode.frequencyBinCount;
        const timeData = new Uint8Array(bufferLength);
        const freqData = new Float32Array(bufferLength);

        let ambientLevel = 0.02;
        let highToneMs = 0;

        const loop = () => {

            if(!this.detectActive) return;

            this.analyserNode.getByteTimeDomainData(timeData);
            this.analyserNode.getFloatFrequencyData(freqData);

            // --- Volume global (RMS) ---
            let sumSquares = 0;
            for(let i = 0; i < timeData.length; i++){
                const v = (timeData[i] - 128) / 128;
                sumSquares += v * v;
            }
            const rms = Math.sqrt(sumSquares / timeData.length);

            ambientLevel = ambientLevel * 0.98 + rms * 0.02;

            const now = Date.now();
            const cooldownOk = (now - this.lastAlertTime) > 4000;

            // --- Détection 1 : bruit soudain (ignore les conversations normales) ---

const dangerLevel = Math.max(
    0.35,
    ambientLevel * 8
);

// Détermine si le niveau sonore augmente brutalement
const suddenIncrease =
    (rms - ambientLevel) > 0.18;

// Une conversation normale augmente généralement
// progressivement le niveau sonore et ne dépasse
// pas ce seuil.

if(

    cooldownOk &&

    rms > dangerLevel &&

    suddenIncrease

){

    this._triggerAlert(
        "Son fort détecté",
        "danger"
    );

}

            // --- Détection 2 : ton aigu soutenu (type alarme / sirène ~1000-3500 Hz) ---
            const sampleRate = this.audioContext.sampleRate;
            const binHz = sampleRate / this.analyserNode.fftSize;
            const loBin = Math.round(1000 / binHz);
            const hiBin = Math.round(3500 / binHz);

            let bandEnergy = 0;
            let totalEnergy = 0.0001;

            for(let i = 0; i < freqData.length; i++){

                const magnitude = Math.pow(10, freqData[i] / 20);
                totalEnergy += magnitude;

                if(i >= loBin && i <= hiBin){
                    bandEnergy += magnitude;
                }

            }

            const bandRatio = bandEnergy / totalEnergy;

            if(rms > 0.08 && bandRatio > 0.5){
                highToneMs += 16;
            } else {
                highToneMs = 0;
            }

            if(cooldownOk && highToneMs > 700){

                this._triggerAlert("Possible alarme ou sirène", "alarm");
                highToneMs = 0;

            }

            this.detectionLoopId = requestAnimationFrame(loop);

        };

        this.detectionLoopId = requestAnimationFrame(loop);

    }

    _triggerAlert(message, type){

        this.lastAlertTime = Date.now();

        this._showVisualAlert(message);

        if(navigator.vibrate){

            navigator.vibrate(
                type === "alarm" ? [200,100,200,100,200] : [300]
            );

        }

        if("speechSynthesis" in window){

            const utter = new SpeechSynthesisUtterance(message);
            utter.lang = "fr-CA";
            speechSynthesis.speak(utter);

        }

    }

    // ============ SOUS-TITRES EN DIRECT ============
    // Note : SpeechRecognition gère le micro de façon indépendante
    // pour éviter le conflit Bluetooth HFP/SCO avec getUserMedia

    subtitles(active){

        const target =
            (typeof active === "boolean") ? active : !this.subtitlesActive;

        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if(!SpeechRecognition){

            this._setStatus("subtitles", "Non disponible — utilise Chrome");
            this.ui.captionFinal.textContent =
                "Reconnaissance vocale non supportée. Utilise Chrome sur Android.";
            this.ui.captionBar.style.display = "block";
            return;

        }

        if(target){

            this.subtitlesActive = true;

            this.recognition = new SpeechRecognition();
            // Langue du navigateur = détection auto (fr-CA par défaut)
            this.recognition.lang = navigator.language || "fr-CA";
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;

            this.recognition.onstart = () => {
                this._setStatus("subtitles", "Micro actif — parle normalement");
            };

            this.recognition.onresult = (event) => {

                let finalText = "";
                let interimText = "";

                for(let i = event.resultIndex; i < event.results.length; i++){

                    const transcript = event.results[i][0].transcript;

                    if(event.results[i].isFinal){
                        finalText += transcript;
                    } else {
                        interimText += transcript;
                    }

                }

                this._updateCaption(finalText, interimText);

            };

            this.recognition.onerror = (event) => {

                console.log("Sous-titres, erreur :", event.error);

                if(event.error === "not-allowed"){
                    this.subtitlesActive = false;
                    this._updateToggleUI("subtitles", false);
                    this._setStatus("subtitles", "Permission refusée");
                    this.ui.captionFinal.textContent =
                        "Permission micro refusée. " +
                        "Appuie sur l icone dans la barre Chrome > " +
                        "Microphone > Autoriser. " +
                        "Si probleme Bluetooth : deconnecte tes ecouteurs, " +
                        "active les sous-titres, puis reconnecte-les.";
                } else if(event.error === "audio-capture"){
                    this._setStatus("subtitles", "Conflit audio — reconnecte tes ecouteurs");
                    this.ui.captionFinal.textContent =
                        "Conflit Bluetooth detecte. " +
                        "Deconnecte tes ecouteurs, reactive les sous-titres, " +
                        "puis reconnecte-les.";
                } else if(event.error !== "no-speech"){
                    this._setStatus("subtitles", "Avertissement: " + event.error);
                }

            };

            // L'API s'arrête souvent après un silence : redémarrage automatique
            this.recognition.onend = () => {

                if(this.subtitlesActive){
                    try { this.recognition.start(); }
                    catch(e){}
                }

            };

            try { this.recognition.start(); } catch(e){}

            this._setStatus("subtitles", "Actif");
            this.ui.captionBar.style.display = "block";

        } else {

            this.subtitlesActive = false;

            if(this.recognition){
                this.recognition.onend = null;
                this.recognition.stop();
            }

            this._setStatus("subtitles", "Inactif");
            this.ui.captionBar.style.display = "none";

        }

        this._updateToggleUI("subtitles", this.subtitlesActive);

    }

    _updateCaption(finalText, interimText){

        if(finalText){

            this.ui.captionFinal.textContent =
                (this.ui.captionFinal.textContent + " " + finalText).trim().slice(-220);

        }

        this.ui.captionInterim.textContent = interimText;

    }

    // ============ INTERFACE (auto-construite) ============

    _buildUI(){

        if(document.getElementById("audio-module-styles")) return;

        const style = document.createElement("style");
        style.id = "audio-module-styles";
        style.textContent = `
            #audio-module-btn{
                position: fixed;
                bottom: 100px;
                right: 16px;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: rgba(20,20,20,0.85);
                color: #fff;
                border: 1px solid rgba(255,255,255,0.2);
                font-size: 20px;
                z-index: 9998;
                cursor: pointer;
            }
            #audio-module-panel{
                position: fixed;
                bottom: 160px;
                right: 16px;
                width: 260px;
                background: rgba(15,15,15,0.95);
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 12px;
                padding: 14px;
                color: #fff;
                font-family: sans-serif;
                font-size: 13px;
                z-index: 9998;
                display: none;
            }
            #audio-module-panel.open{ display: block; }
            #audio-module-panel h3{ margin: 0 0 10px 0; font-size: 14px; }
            .audio-row{
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
            }
            .audio-row label{ flex: 1; }
            .audio-status{
                font-size: 11px;
                opacity: 0.7;
                margin: 0 0 10px 0;
            }
            #audio-alert-flash{
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 9999;
                opacity: 0;
            }
            #audio-alert-flash.show{
                opacity: 1;
                box-shadow: inset 0 0 0 10px red;
                animation: audioFlashPulse 0.6s ease-out 2;
            }
            @keyframes audioFlashPulse{
                0%{ box-shadow: inset 0 0 0 10px red; }
                50%{ box-shadow: inset 0 0 0 2px red; }
                100%{ box-shadow: inset 0 0 0 10px red; }
            }
            #audio-alert-text{
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(200,0,0,0.9);
                color: #fff;
                padding: 10px 18px;
                border-radius: 8px;
                font-family: sans-serif;
                font-weight: bold;
                z-index: 10000;
                display: none;
            }
            #audio-caption-bar{
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(0,0,0,0.75);
                color: #fff;
                font-family: sans-serif;
                padding: 10px 16px;
                font-size: 15px;
                line-height: 1.4;
                z-index: 9997;
                display: none;
            }
            #audio-caption-bar .interim{ opacity: 0.6; font-style: italic; }
            #audio-gain-slider{ width: 100%; margin-bottom: 12px; }
        `;
        document.head.appendChild(style);

        const btn = document.createElement("button");
        btn.id = "audio-module-btn";
        btn.title = "Fonctions auditives";
        btn.textContent = "👂";
        document.body.appendChild(btn);

        const panel = document.createElement("div");
        panel.id = "audio-module-panel";
        panel.innerHTML = `
            <h3>Fonctions auditives</h3>

            <div class="audio-row">
                <label>Amplification du son</label>
                <input type="checkbox" id="audio-amplify-toggle">
            </div>
            <div class="audio-status" id="audio-amplify-status">Inactif</div>
            <input type="range" id="audio-gain-slider" min="1" max="6" step="0.5" value="2.5">

            <div class="audio-row">
                <label>Détection de sons importants</label>
                <input type="checkbox" id="audio-detect-toggle">
            </div>
            <div class="audio-status" id="audio-detect-status">Inactif</div>

            <div class="audio-row">
                <label>Sous-titres en direct</label>
                <input type="checkbox" id="audio-subtitles-toggle">
            </div>
            <div class="audio-status" id="audio-subtitles-status">Inactif</div>
        `;
        document.body.appendChild(panel);

        btn.addEventListener("click", () => panel.classList.toggle("open"));

        const flash = document.createElement("div");
        flash.id = "audio-alert-flash";
        document.body.appendChild(flash);

        const alertText = document.createElement("div");
        alertText.id = "audio-alert-text";
        document.body.appendChild(alertText);

        const captionBar = document.createElement("div");
        captionBar.id = "audio-caption-bar";
        captionBar.innerHTML =
            `<span id="audio-caption-final"></span> <span class="interim" id="audio-caption-interim"></span>`;
        document.body.appendChild(captionBar);

        this.ui = {
            btn, panel,
            amplifyToggle: document.getElementById("audio-amplify-toggle"),
            amplifyStatus: document.getElementById("audio-amplify-status"),
            gainSlider: document.getElementById("audio-gain-slider"),
            detectToggle: document.getElementById("audio-detect-toggle"),
            detectStatus: document.getElementById("audio-detect-status"),
            subtitlesToggle: document.getElementById("audio-subtitles-toggle"),
            subtitlesStatus: document.getElementById("audio-subtitles-status"),
            flash, alertText, captionBar,
            captionFinal: document.getElementById("audio-caption-final"),
            captionInterim: document.getElementById("audio-caption-interim")
        };

        this.ui.amplifyToggle.addEventListener("change", (e) => {
            this.amplify(e.target.checked).catch(err => {
                this._setStatus("amplify", "Erreur : " + err.message);
                this.ui.amplifyToggle.checked = false;
            });
        });

        this.ui.gainSlider.addEventListener("input", (e) => {
            this.setAmplifyGain(parseFloat(e.target.value));
        });

        this.ui.detectToggle.addEventListener("change", (e) => {
            this.detectSound(e.target.checked).catch(err => {
                this._setStatus("detect", "Erreur : " + err.message);
                this.ui.detectToggle.checked = false;
            });
        });

        this.ui.subtitlesToggle.addEventListener("change", (e) => {
            this.subtitles(e.target.checked);
        });

    }

    _setStatus(key, text){
        const el = this.ui[key + "Status"];
        if(el) el.textContent = text;
    }

    _updateToggleUI(key, active){
        const el = this.ui[key + "Toggle"];
        if(el) el.checked = active;
    }

    _showVisualAlert(message){

        this.ui.alertText.textContent = "⚠ " + message;
        this.ui.alertText.style.display = "block";

        this.ui.flash.classList.remove("show");
        void this.ui.flash.offsetWidth;
        this.ui.flash.classList.add("show");

        clearTimeout(this._alertHideTimer);
        this._alertHideTimer = setTimeout(() => {
            this.ui.alertText.style.display = "none";
        }, 3500);

    }

}

function initializeAudioModule(){

    if(!audioModule){
        audioModule = new AudioModule();
    }

}

console.log("audio.js chargé");
