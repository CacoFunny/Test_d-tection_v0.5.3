// =======================================
// VisionHUD v0.3
// memory.js
// =======================================

const MAX_SCENE_MEMORY = 20;

let sceneMemory = [];

function rememberScene(text){

    if(!text) return;

    sceneMemory.unshift({

        time: Date.now(),

        mode: currentMode,

        text

    });

    if(sceneMemory.length > MAX_SCENE_MEMORY){

        sceneMemory.pop();

    }

}

function clearSceneMemory(){

    sceneMemory = [];

}

function getSceneMemory(){

    return sceneMemory;

}

function getRecentScenes(seconds = 30){

    const limit =
        Date.now() - (seconds * 1000);

    return sceneMemory.filter(scene =>

        scene.time >= limit

    );

}

function getLastScene(){

    if(sceneMemory.length === 0)
        return null;

    return sceneMemory[0];

}

function summarizeRecentScenes(seconds = 30){

    const scenes =
        getRecentScenes(seconds);

    if(scenes.length === 0)
        return "Aucune scène récente.";

    return scenes
        .map(scene => scene.text)
        .join("\n");

}

console.log("memory.js chargé");