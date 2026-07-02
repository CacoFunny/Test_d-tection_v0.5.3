// ===================== CONFIG DES MODES =====================
const TRANSLATE_SOURCE_KEY = 'visionhud_translate_source_lang';
const TRANSLATE_TARGET_KEY = 'visionhud_translate_target_lang';

let translateSourceLang = localStorage.getItem(TRANSLATE_SOURCE_KEY) || 'auto';
let translateTargetLang = localStorage.getItem(TRANSLATE_TARGET_KEY) || 'français';

// ===================== VISIONHUD V0.2 CONFIG =====================

// Langues centralisées
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

// Priorités futures
const PRIORITY = {
  DANGER: 100,
  NAVIGATION: 80,
  SOCIAL: 60,
  TECHNIQUE: 50,
  TRADUCTION: 40,
  CONTEXTE: 30,
  ARCHIVE: 10
};

// Modules disponibles
const MODULES = {
  vision: true,
  audio: true,
  subtitles: true,
  adaptive: false,
  assistant: true
};

// Mémoire courte de VisionHUD
const MAX_SCENE_MEMORY = 20;
let sceneMemory = [];

// ===================== VOICE COMMANDS =====================

let voiceRecognition = null;
let voiceCommandsEnabled = false;

const VOICE_COMMANDS = {
  "mode équilibre": "equilibre",
  "mode sécurité": "securite",
  "mode social": "social",
  "mode contextuel": "contextuel",
  "mode traduction": "traduction",
  "mode archive": "archive",
  "mode technique": "technique"
};

function setTranslateSource(lang) {
  translateSourceLang = lang;
  localStorage.setItem(TRANSLATE_SOURCE_KEY, lang);

  if (translateSourceSelect) {
    translateSourceSelect.value = lang;
  }
}

function setTranslateTarget(lang) {
  translateTargetLang = lang;
  localStorage.setItem(TRANSLATE_TARGET_KEY, lang);

  if (translateTargetSelect) {
    translateTargetSelect.value = lang;
  }
}

function saveTranslateSettings() {
  setTranslateSource(translateSourceSelect.value);
  setTranslateTarget(translateTargetSelect.value);
}

function rememberScene(text) {

  if (!text) return;

  sceneMemory.unshift({
    time: Date.now(),
    mode: currentMode,
    text
  });

  if (sceneMemory.length > MAX_SCENE_MEMORY) {
    sceneMemory.pop();
  }
}

function buildTranslatePrompt() {
  const sourceInstruction = translateSourceLang === 'auto'
    ? 'Détecte automatiquement la langue source de chaque texte.'
    : `La langue source à utiliser est : ${translateSourceLang}.`;

  return `Tu es un système de vision embarqué façon HUD orienté TRADUCTION. Analyse cette image et détecte TOUT texte visible (panneaux, affiches, emballages, écrans, menus, etc.). ${sourceInstruction} Pour chaque texte trouvé : traduis-le en ${translateTargetLang}. Format STRICT : une ligne par texte trouvé, "TRADUCTION: [langue source→${translateTargetLang}] traduction courte du texte". Maximum 3 lignes. Si aucun texte visible, réponds "RIEN: aucun texte détecté". Si le texte est déjà en ${translateTargetLang}, réponds "RIEN: texte déjà en ${translateTargetLang}".`;
}

const MODES = {
  equilibre: {
    label: "Équilibré",
    socialFreq: false,
    prompt: `Tu es un système de vision embarqué façon HUD. Analyse cette image et liste MAXIMUM 3 éléments vraiment notables, mélangés entre sécurité, présence humaine, et information contextuelle. Sois CERTAIN avant de mentionner un élément — si tu n'es pas sûr à 90%, ne le mentionne pas. Ne mentionne jamais une marque si tu n'es pas certain. Pour chaque élément, inclus une distance approximative si pertinent (ex: proche ~1m, milieu ~3m, loin ~6m+). Format STRICT : une ligne par élément, "CATEGORIE: description courte (6-9 mots max) [distance si pertinent]". CATEGORIE doit être: SECURITE, SOCIAL, ou CONTEXTE. Pas de phrase complète, pas d'intro, pas de conclusion. Si rien de notable, réponds "RIEN: aucun élément notable".`
  },
  securite: {
  label: "Sécurité",
  socialFreq: false,
  prompt: `Tu es un système de vision embarqué VisionHUD orienté SÉCURITÉ ET NAVIGATION.

Analyse l'image et détecte en priorité tout ce qui peut gêner, ralentir ou mettre une personne en danger.

Recherche notamment :

- obstacles au sol (boîtes, sacs, câbles, outils, objets)
- fils électriques
- marches
- escaliers
- bordures
- portes ouvertes
- véhicules
- vélos
- personnes bloquant le passage
- flaques d'eau
- surfaces glissantes
- trous
- mobilier
- objets suspendus
- sources de chaleur
- tout obstacle pouvant provoquer une chute.

Pour chaque élément détecté, indique :

- une description très courte (6 à 10 mots)
- la position (gauche, centre ou droite)
- une distance approximative (proche ~1m, milieu ~3m, loin ~6m)

Format STRICT :

SECURITE: description [position, distance]

Maximum 3 lignes.

Si aucun obstacle évident n'est visible, réponds uniquement :

RIEN: aucun obstacle détecté.

Considère comme obstacle tout objet pouvant gêner le déplacement d'une personne, même s'il ne représente pas un danger immédiat.`
},
  social: {
    label: "Social",
    socialFreq: true,
    prompt: `Tu es un système de vision embarqué façon HUD orienté SOCIAL. Analyse cette image et liste MAXIMUM 3 éléments sur la présence humaine. Pour chaque personne ou groupe: nombre, distance approximative (proche ~1m, milieu ~3m, loin ~6m+), direction (gauche/centre/droite), et SEULEMENT si clairement visible: expression faciale (souriant / neutre / concentré / contrarié — sois prudent et conservateur sur les émotions, ne devine pas). Si tu n'es pas certain de l'émotion, ne la mentionne pas. Format STRICT : une ligne, "SOCIAL: description (6-9 mots max) [distance]". Si aucune personne visible, réponds "RIEN: aucune personne détectée".`
  },
  contextuel: {
    label: "Contextuel",
    socialFreq: false,
    prompt: `Tu es un système de vision embarqué façon HUD orienté CONTEXTE/INFO. Analyse cette image et liste MAXIMUM 3 éléments vraiment utiles : texte visible important (panneaux, affiches, écrans — indique le SUJET du texte, pas tout le texte), objets/repères clés (porte, sortie, escalier, ascenseur). Inclus distance approximative (proche ~1m, milieu ~3m, loin ~6m+) si pertinent. Ne mentionne une marque que si tu es certain à 90%+. Format STRICT : une ligne par élément, "CONTEXTE: description (6-9 mots max) [distance si pertinent]". Si rien, réponds "RIEN: aucune information notable".`
  },
  traduction: {
    label: "Traduction",
    socialFreq: false,
    prompt: buildTranslatePrompt
  },
  archive: {
    label: "Archive",
    socialFreq: false,
    prompt: `Tu es un système de vision embarqué en mode ARCHIVE silencieux. Résume cette image en UNE seule ligne factuelle et courte (10 mots max) pour un journal visuel, format "ARCHIVE: résumé court". Sois neutre et factuel, comme un horodatage de journal de bord.`
  },
  technique: {
    label: "Technique",
    socialFreq: false,
    prompt: `Tu es un système de vision embarqué façon HUD orienté SCAN TECHNIQUE. Analyse cette image et identifie MAXIMUM 3 objets technologiques CLAIREMENT visibles. Mentionne une marque ou modèle SEULEMENT si tu en es certain à 90%+ — sinon décris juste le type d'objet (ex: "smartphone noir", pas "iPhone" si tu n'es pas sûr). Inclus distance approximative (proche ~1m, milieu ~3m, loin ~6m+). Format STRICT : une ligne par élément, "TECHNIQUE: description (6-9 mots max) [distance]". Si rien, réponds "RIEN: aucun élément technique détecté".`
  }
};

// ===================== STATE =====================
let apiKey = localStorage.getItem('visionhud_api_key') || null;
let currentMode = 'equilibre';
let captureFreq = 4000;
let isRunning = false;
let isMuted = false;
let voiceRate = 1.0;
let captureLoopTimer = null;
let isAnalyzing = false;
let archiveEntries = [];
let videoStream = null;
let activeTagTexts = new Map(); // pour anti-doublons: texte → élément DOM

// ===================== DOM REFS =====================
const startScreen = document.getElementById('start-screen');
const apiKeyInput = document.getElementById('api-key-input');
const startBtn = document.getElementById('start-btn');
const startError = document.getElementById('start-error');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const tagsLayer = document.getElementById('tags-layer');
const emptyHint = document.getElementById('empty-hint');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const modeLabel = document.getElementById('mode-label');
const captureToggle = document.getElementById('capture-toggle');
const freqBtn = document.getElementById('freq-btn');
const muteBtn = document.getElementById('mute-btn');
const scanLine = document.getElementById('scanLine');
const settingsBtn = document.getElementById('settings-btn');
const assistantBtn = document.getElementById('assistant-btn');

const settingsPanel = document.getElementById('settings-panel');
const closeSettings = document.getElementById('close-settings');
const freqOptions = document.getElementById('freq-options');
const voiceToggle = document.getElementById('voice-toggle');
const voiceRateSelect = document.getElementById('voice-rate');
const archiveSection = document.getElementById('archive-section');
const archiveLog = document.getElementById('archive-log');
const clearKeyBtn = document.getElementById('clear-key-btn');
const translateSection = document.getElementById('translate-section');
const translateSourceSelect = document.getElementById('translate-source-select');
const translateTargetSelect = document.getElementById('translate-target-select');

// ===================== INIT =====================
function populateLanguageSelectors() {

  if (!translateSourceSelect || !translateTargetSelect) return;

  translateSourceSelect.innerHTML = "";
  translateTargetSelect.innerHTML = "";

  LANGUAGES.forEach(language => {

    // Liste langue source
    const sourceOption = document.createElement("option");
    sourceOption.value = language.id;
    sourceOption.textContent = language.label;
    translateSourceSelect.appendChild(sourceOption);

    // La langue cible ne propose pas "Auto"
    if (language.id !== "auto") {
      const targetOption = document.createElement("option");
      targetOption.value = language.id;
      targetOption.textContent = language.label;
      translateTargetSelect.appendChild(targetOption);
    }

  });

}

function init() {

  if (apiKey) {
    startScreen.style.display = 'none';
    initCamera();
  }

  startBtn.addEventListener('click', handleStart);

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => selectMode(btn.dataset.mode));
  });

  captureToggle.addEventListener('click', toggleCapture);

  freqBtn.addEventListener('click', () => {
    settingsPanel.classList.add('open');
  });

  muteBtn.addEventListener('click', toggleMute);

settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.add('open');
});

assistantBtn.addEventListener('click', openAssistant);

closeSettings.addEventListener('click', () => {
  settingsPanel.classList.remove('open');
});

  freqOptions.querySelectorAll('.freq-opt').forEach(btn => {
    btn.addEventListener('click', () => selectFreq(btn));
  });

  voiceToggle.addEventListener('change', () => {
    isMuted = !voiceToggle.checked;
    updateMuteIcon();
  });

  voiceRateSelect.addEventListener('change', () => {
    voiceRate = parseFloat(voiceRateSelect.value);
  });

  clearKeyBtn.addEventListener('click', clearApiKey);

  populateLanguageSelectors();

  translateSourceSelect.value = translateSourceLang;
  translateTargetSelect.value = translateTargetLang;

  translateSourceSelect.addEventListener('change', saveTranslateSettings);
translateTargetSelect.addEventListener('change', saveTranslateSettings);

initializeVoiceRecognition();

initializeAssistant();

initializeAudioModule();

}

function handleStart() {
  const val = apiKeyInput.value.trim();
  if (!val.startsWith('sk-ant-')) {
    startError.textContent = "Ça ne ressemble pas à une clé API Claude valide (doit commencer par sk-ant-).";
    return;
  }
  apiKey = val;
  localStorage.setItem('visionhud_api_key', apiKey);
  startScreen.style.display = 'none';
  initCamera();
}

function clearApiKey() {
  localStorage.removeItem('visionhud_api_key');
  apiKey = null;
  stopCapture();
  if (videoStream) videoStream.getTracks().forEach(t => t.stop());
  settingsPanel.classList.remove('open');
  startScreen.style.display = 'flex';
  apiKeyInput.value = '';
}

// ===================== CAMERA =====================
async function initCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = videoStream;
    await video.play();
  } catch (err) {
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = videoStream;
      await video.play();
    } catch (err2) {
      showTag('CONTEXTE', `Erreur caméra: ${err2.message}`, 'contextuel');
    }
  }
}

function captureFrame() {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return null;
  // Mode traduction : résolution plus haute pour mieux lire le texte fin
  const longEdge = currentMode === 'traduction' ? 900 : 750;
  const scale = Math.min(1, longEdge / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const quality = currentMode === 'traduction' ? 0.85 : 0.72;
  return canvas.toDataURL('image/jpeg', quality).split(',')[1];
}

// ===================== MODE / FREQ / MUTE UI =====================
function selectMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  modeLabel.textContent = MODES[mode].label;
  archiveSection.style.display = mode === 'archive' ? 'block' : 'none';
  translateSection.style.display = 'block';
  // Si scan en cours, redémarre la boucle avec le bon intervalle pour ce mode
  if (isRunning) { stopCaptureLoop(); startCaptureLoop(); }
}

function getEffectiveFreq() {
  // Mode social : forcé à 5s; autres : fréquence choisie par l'utilisateur
  return (MODES[currentMode] && MODES[currentMode].socialFreq) ? 5000 : captureFreq;
}

function selectFreq(btn) {
  captureFreq = parseInt(btn.dataset.freq, 10);
  freqOptions.querySelectorAll('.freq-opt').forEach(b => b.classList.toggle('active', b === btn));
  freqBtn.textContent = (captureFreq / 1000) + 's';
  if (isRunning) { stopCaptureLoop(); startCaptureLoop(); }
}

function toggleMute() {
  isMuted = !isMuted;
  voiceToggle.checked = !isMuted;
  updateMuteIcon();
  if (isMuted) window.speechSynthesis.cancel();
}
function updateMuteIcon() { muteBtn.textContent = isMuted ? '🔇' : '🔊'; }

// ===================== CAPTURE LOOP =====================
function toggleCapture() {
  if (isRunning) { stopCapture(); } else { startCapture(); }
}

function startCapture() {
  isRunning = true;
  captureToggle.textContent = '■ Arrêter le scan';
  captureToggle.classList.add('running');
  statusDot.classList.add('live');
  statusText.textContent = 'Scan actif';
  emptyHint.style.display = 'none';
  clearTags();
  startCaptureLoop();
}

function stopCapture() {
  isRunning = false;
  captureToggle.textContent = '▶ Démarrer le scan';
  captureToggle.classList.remove('running');
  statusDot.classList.remove('live');
  statusText.textContent = 'En pause';
  stopCaptureLoop();
  window.speechSynthesis.cancel();
}

function startCaptureLoop() {
  runAnalysisCycle();
  captureLoopTimer = setInterval(runAnalysisCycle, getEffectiveFreq());
}
function stopCaptureLoop() {
  if (captureLoopTimer) clearInterval(captureLoopTimer);
  captureLoopTimer = null;
}

function clearTags() {
  // Enlève tous les tags sauf le hint
  Array.from(tagsLayer.children).forEach(c => {
    if (c.id !== 'empty-hint') tagsLayer.removeChild(c);
  });
  activeTagTexts.clear();
}

async function runAnalysisCycle() {
  if (isAnalyzing) return;
  isAnalyzing = true;
  triggerScanLine();
  const frame = captureFrame();
  if (!frame) { isAnalyzing = false; return; }
  try {
    const result = await analyzeFrame(frame, currentMode);
    handleAnalysisResult(result);
  } catch (err) {
    showTag('SECURITE', `Erreur API: ${err.message}`, 'securite', true, true);
  } finally {
    isAnalyzing = false;
  }
}

function triggerScanLine() {
  scanLine.classList.remove('active');
  void scanLine.offsetWidth;
  scanLine.classList.add('active');
}

// ===================== API CALL =====================
async function analyzeFrame(base64Image, mode) {
  const promptRaw = MODES[mode].prompt;
  const promptText = typeof promptRaw === 'function' ? promptRaw() : promptRaw;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 220,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
          { type: 'text', text: promptText }
        ]
      }]
    })
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`${response.status} ${errBody.slice(0, 80)}`);
  }
  const data = await response.json();

const textBlock = data.content.find(
    b => b.type === "text"
);

const result = textBlock ? textBlock.text : "";

console.log("MODE :", mode);
console.log("CLAUDE :", result);

return result;
 
}

// ===================== RESULT HANDLING =====================
function normalizeText(str) {
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isDuplicate(desc) {
  const norm = normalizeText(desc);
  // Vérifie si un tag identique ou très similaire est déjà à l'écran
  for (const [existingText] of activeTagTexts) {
    if (existingText === norm) return true;
    // Similarité simple: si 80%+ des mots sont communs
    const wordsNew = norm.split(' ');
    const wordsOld = existingText.split(' ');
    const common = wordsNew.filter(w => w.length > 3 && wordsOld.includes(w));
    if (wordsNew.length > 2 && common.length / wordsNew.length >= 0.75) return true;
  }
  return false;
}

function refreshTag(desc) {
  const norm = normalizeText(desc);
  for (const [existingText, el] of activeTagTexts) {
    if (existingText === norm) {
      // Rafraîchit visuellement le tag existant (bref flash)
      el.style.transition = 'border-left-color 0.15s';
      el.style.borderLeftColor = '#fff';
      setTimeout(() => { el.style.borderLeftColor = ''; el.style.transition = ''; }, 200);
      return;
    }
  }
}

function handleAnalysisResult(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  rememberScene(rawText);

  if (currentMode === 'archive') {
    const line = lines[0] || 'ARCHIVE: rien';
    const desc = line.replace(/^ARCHIVE:\s*/i, '');
    archiveEntries.unshift({ time: new Date().toLocaleTimeString('fr-CA', {hour:'2-digit',minute:'2-digit'}), desc });
    if (archiveEntries.length > 30) archiveEntries.pop();
    renderArchiveLog();
    showTag('ARCHIVE', desc, 'archive', false);
    return;
  }

  for (const line of lines) {
    const m = line.match(/^(SECURITE|SOCIAL|CONTEXTE|TECHNIQUE|TRADUCTION|RIEN):\s*(.+)$/i);
    if (!m) continue;
    const cat = m[1].toUpperCase();
    const desc = m[2];
    if (cat === 'RIEN') continue;
    const catClass = {
      SECURITE: 'securite',
      SOCIAL: 'social',
      CONTEXTE: 'contextuel',
      TECHNIQUE: 'technique',
      TRADUCTION: 'traduction'
    }[cat] || 'contextuel';

    if (isDuplicate(desc)) {
      refreshTag(desc);
      continue; // ne répète pas, juste rafraîchit
    }
    showTag(cat, desc, catClass, true);
  }
}

function renderArchiveLog() {
  if (archiveEntries.length === 0) { archiveLog.textContent = 'Aucune entrée encore.'; return; }
  archiveLog.innerHTML = archiveEntries.map(e => `<div>${e.time} — ${escapeHtml(e.desc)}</div>`).join('');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

const CAT_ICON = { SECURITE: '▲', SOCIAL: '◉', CONTEXTE: '▤', TECHNIQUE: '◈', ARCHIVE: '◷', TRADUCTION: '⇄' };

function showTag(cat, desc, catClass, speak = true, isError = false) {
  const tag = document.createElement('div');
  tag.className = `tag cat-${catClass}`;
  tag.innerHTML = `<span class="tag-icon">${CAT_ICON[cat] || '•'}</span>${escapeHtml(desc)}`;
  tagsLayer.appendChild(tag);

  const normDesc = normalizeText(desc);
  activeTagTexts.set(normDesc, tag);

  // Max 5 tags visibles — retire le plus ancien si dépassé
  const visibleTags = Array.from(tagsLayer.children).filter(c => c.id !== 'empty-hint');
  if (visibleTags.length > 5) {
    const oldest = visibleTags[0];
    // Retire aussi de la map anti-doublons
    for (const [k, v] of activeTagTexts) {
      if (v === oldest) { activeTagTexts.delete(k); break; }
    }
    tagsLayer.removeChild(oldest);
  }

  // Fade + suppression après un délai
  const fadeDelay = isError ? 8000 : 9000;
  const removeDelay = isError ? 12000 : 16000;
  setTimeout(() => { if (tag.parentNode) tag.classList.add('tag-fade'); }, fadeDelay);
  setTimeout(() => {
    if (tag.parentNode) tag.parentNode.removeChild(tag);
    for (const [k, v] of activeTagTexts) {
      if (v === tag) { activeTagTexts.delete(k); break; }
    }
  }, removeDelay);

  if (speak && !isMuted) speakText(desc);
}

// ===================== VOICE =====================
function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  // Nettoie les crochets de distance pour la lecture orale (ex: [proche ~1m] → "proche 1 mètre")
  const cleanText = text
    .replace(/\[([^\]]+)\]/g, ', $1')
    .replace(/~(\d+)m/g, '$1 mètres')
    .replace(/~(\d+)m\+/g, 'plus de $1 mètres');
  const utter = new SpeechSynthesisUtterance(cleanText);
  utter.lang = 'fr-CA';
  utter.rate = voiceRate;
  window.speechSynthesis.speak(utter);
}

// ===================== START =====================
function changeMode(mode) {

  if (!MODES[mode]) return;

  selectMode(mode);

}

function initializeVoiceRecognition() {

  const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.log("Reconnaissance vocale non supportée.");
    return;
  }

  voiceRecognition = new SpeechRecognition();

  voiceRecognition.lang = "fr-CA";
  voiceRecognition.continuous = true;
  voiceRecognition.interimResults = false;

  voiceRecognition.onresult = (event) => {

    const result =
      event.results[event.results.length - 1][0].transcript;

    console.log("Commande :", result);

    executeVoiceCommand(result);

  };

  voiceRecognition.onerror = (event) => {
    console.log(event.error);
  };

}

function executeVoiceCommand(command) {

  const cmd = command.toLowerCase().trim();

  if (VOICE_COMMANDS[cmd]) {
    changeMode(VOICE_COMMANDS[cmd]);
    return true;
  }

  switch (cmd) {

    case "démarrer":
    case "démarrer le scan":
      if (!isRunning) startCapture();
      return true;

    case "arrêter":
    case "arrêter le scan":
      if (isRunning) stopCapture();
      return true;

    case "muet":
      if (!isMuted) toggleMute();
      return true;

    case "son":
      if (isMuted) toggleMute();
      return true;

    default:
      return false;

  }

}

init();