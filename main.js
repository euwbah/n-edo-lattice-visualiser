import * as THREE from 'three';
import { HarmonicContext } from './harmonic-context.js';
import * as NoteTracking from './note-tracking.js';
import { BallsManager, Camera, KeyCenterParticleFountain, ScaffoldingManager } from './drawn-objects.js';
import { HARMONIC_CONTEXT_METHOD, USE_MIDI, HELD_NOTE_HAPPENINGNESS, MAX_SHORT_TERM_MEMORY, SCULPTURE_MODE, SCULPTURE_PX_DENSITY, SUSTAINED_NOTE_HAPPENINGNESS, VERSION, addHappeningness, INTERACTIVE } from './configs.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DebugEnvironment } from 'three/addons/environments/DebugEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { Sculpture } from './sculpture.js';

/**
 * @type {THREE.Scene}
 */
let scene = new THREE.Scene();
window.scene = scene;

const socket = !USE_MIDI ? new WebSocket('ws://127.0.0.1:8765') : null;

const ballManager = new BallsManager();
window.ballManager = ballManager;
const scaffoldingManager = new ScaffoldingManager();
window.scaffoldingManager = scaffoldingManager;
let harmonicContext = new HarmonicContext();
window.harmonicContext = harmonicContext;
const cameraObject = new Camera(harmonicContext);
window.cam = cameraObject;
const particleFountain = new KeyCenterParticleFountain();
window.fountain = particleFountain;
const raycaster = INTERACTIVE ? new THREE.Raycaster() : null;
window.raycaster = raycaster;
const mouse = new THREE.Vector2(1, 1);
window.mouse = mouse;
document.addEventListener('mousemove', (event) => {
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
});

let pxDensity = window.devicePixelRatio * SCULPTURE_MODE ? SCULPTURE_PX_DENSITY : 1;

renderer.autoClear = true;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1;

renderer.setSize(window.innerWidth * pxDensity, window.innerHeight * pxDensity, false);
document.body.appendChild(renderer.domElement);

// setting up stuff for postprocessing

/** @type {EffectComposer} */
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, cameraObject.camera);
composer.addPass(renderPass);

const ssrPass = new SSRPass({
    renderer,
    scene,
    camera: cameraObject.camera,
    width: window.innerWidth,
    height: window.innerHeight
});
ssrPass.thickness = 0.018;
ssrPass.bouncing = true;
ssrPass.fresnel = true;
ssrPass.maxDistance = 10;
composer.addPass(ssrPass);

const blurPass = new BokehPass(scene, cameraObject.camera, {
    focus: 1.0,
    aperture: 2.7,
    maxblur: 0
});
composer.addPass(blurPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0, 0.02, 0);
composer.addPass(bloomPass);

if (socket != null) {
    socket.onopen = (e) => {
        console.log('web socket connected');
    }

    socket.onmessage = (e) => {
        // only start reading socket messages when WASM is loaded
        if (LOADED) {
            // rest will contian exact harmonic coordinate data for 12ji harmonic context mode.
            /**
             *
             * @type {string[]}
             */
            let [type, data1, data2, ...rest] = e.data.split(':');
            data1 = parseInt(data1);
            data2 = parseInt(data2);
            if (type === 'on') {
                if (data2 === 0) {
                    // a note on with 0 velocity should be handled as a note off.
                    NoteTracking.noteOff(data1, data2);
                    return;
                }
                let monData = null;
                if (HARMONIC_CONTEXT_METHOD === '12ji') {
                    // Empty string: 1/1 (no prime decomposition)
                    if (rest.length === 1 && rest[0].length === 0) {
                        monData = [0];
                    } else {
                        monData = rest.map(x => {
                            /** @type {number} */
                            let int = parseInt(x);
                            if (isNaN(int)) throw new Error(`Invalid monzo data: ${rest}`);
                            return int;
                        });
                    }
                }
                // console.log(monData);
                NoteTracking.noteOn(data1, data2,
                    harmonicContext, ballManager, scaffoldingManager, monData);
            } else if (type === 'off') {
                NoteTracking.noteOff(data1, data2);
            } else if (type === 'cc') {
                NoteTracking.cc(data1, data2);

                if (data1 === 123) {
                    // all notes off reserved cc message.
                    offAll();
                }
            }
        }
    }
} else {
    // Use MIDI
    navigator.requestMIDIAccess().then((midiAccess) => {
        // TODO: Don't assume 12 edo and make input selector instead of activating all inputs
        console.log('MIDI Inputs');
        midiAccess.inputs.forEach((input, idx) => {
            console.log(`${idx}: ${input.name}`);
        })
        // the URL hash can be used to select a specific MIDI input.
        if (window.location.hash.length === 0) {
            console.log('Select a MIDI input by appending #<input key> to the end of the URL');
        }
        let inputIdx = window.location.hash.substring(1) || "input-0";
        let input = midiAccess.inputs.get(inputIdx);
        if (input === undefined) {
            console.error(`MIDI input ${inputIdx} not found.`);
            return;
        }
        console.log(`Connected to MIDI input ${inputIdx}: ${input.name}`);
        input.onmidimessage = (msg) => {
            // console.log(`MIDI ${input.name}: ${msg.data}`);
            let [cmd, param1, param2] = msg.data;
            if ((cmd & 0xF0) == 0x90) {
                // params: key, velocity
                // convert midi note number to semitones from A4 by subtracting 69
                NoteTracking.noteOn(param1 - 69, param2, harmonicContext, ballManager, scaffoldingManager);
            } else if ((cmd & 0xF0) == 0x80) {
                // params: key, velocity
                NoteTracking.noteOff(param1 - 69, param2);
            } else if ((cmd & 0xF0) == 0xB0) {
                // params: CC number, cc value
                NoteTracking.cc(param1, param2);

                if (param1 === 123) {
                    // all notes off reserved cc message.
                    offAll();
                }
            }
        }
    });
}

function testOn(stepsFromA, coords = null) {
    NoteTracking.noteOn(stepsFromA, 127, harmonicContext, ballManager, scaffoldingManager, coords);
}

function testOff(stepsFromA) {
    NoteTracking.noteOff(stepsFromA, 127);
}

window.on = testOn;
window.off = testOff;

window.addEventListener('resize', () => {
    cameraObject.updateAspectRatio();
    ssrPass.setSize(window.innerWidth, window.innerHeight);
    bloomPass.setSize(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth * pxDensity, window.innerHeight * pxDensity, false);
}, false);

let clock = new THREE.Clock();

window.ambientLight = new THREE.AmbientLight(0xffffff, 5);
scene.add(ambientLight);

let pmremgen = new THREE.PMREMGenerator(renderer);
pmremgen.compileCubemapShader();

const envScene = new RoomEnvironment();

let envTexTarget = pmremgen.fromScene(envScene);
scene.environment = envTexTarget.texture;
// scene.background = envTexTarget.texture;

/**
 * @type {Sculpture}
 */
let sculpture = null;

if (SCULPTURE_MODE) {
    fetch('./recording.json')
        .then(response => response.json())
        .then(json => {
            sculpture = new Sculpture(json);
            window.sculpture = sculpture;
        });
}

/**
 * When mouse clicked, copy this text to clipboard, if not empty.
 */
let copyText = '';

let lastFPSUpdateTime = new Date();
let numFramesSinceLastFPSUpdateTime = 0;
window.FPS = 0;

function animate() {
    requestAnimationFrame(animate);
    numFramesSinceLastFPSUpdateTime++;
    let now = new Date();
    if (now - lastFPSUpdateTime > 500) {
        window.FPS = numFramesSinceLastFPSUpdateTime / ((now - lastFPSUpdateTime) / 1000);
        lastFPSUpdateTime = now;
        numFramesSinceLastFPSUpdateTime = 0;
    }
    /** Duration between each {@linkcode animate()} frame in milliseconds. */
    window.deltaTime = clock.getDelta() * 1000;
    let intersections = [];
    if (INTERACTIVE) {
        raycaster.setFromCamera(mouse, cameraObject.camera);
        intersections = raycaster.intersectObjects(scene.children, false);
    }

    if (SCULPTURE_MODE) {
        cameraObject.tick(0);

        if (!sculpture) return; // wait for sculpture/json to load

        cameraObject.center.copy(sculpture.centroid);
        sculpture.tick();
        renderer.toneMappingExposure = 1.2;
        bloomPass.threshold = 0;
        bloomPass.strength = 1.4;
        bloomPass.radius = 0.05;
        blurPass.uniforms['maxblur'].value = 0.1;

        composer.render();
    } else {
        let [held, sustained] = NoteTracking.countExistingKeysState();
        addHappeningness(deltaTime / 4000 * (held * HELD_NOTE_HAPPENINGNESS + sustained * SUSTAINED_NOTE_HAPPENINGNESS));
        HAPPENINGNESS = Math.max(0, HAPPENINGNESS - Math.pow(HAPPENINGNESS, 1.5) * deltaTime / 1500);

        harmonicContext.tick();
        ballManager.tick(NoteTracking.KEYS_STATE, harmonicContext);
        particleFountain.tick(harmonicContext);
        scaffoldingManager.tick();
        cameraObject.tick(ballManager.stdDeviation);

        // Update shader settings
        renderer.toneMappingExposure = 1.1 + HAPPENINGNESS * 0.3;
        bloomPass.threshold = 0;
        bloomPass.strength = 0.2 + Math.pow(HAPPENINGNESS, 4) * 3;
        bloomPass.radius = 0.01 + 0.03 * Math.pow(HAPPENINGNESS, 4);
        blurPass.uniforms['maxblur'].value = 0.05 * Math.pow(HAPPENINGNESS, 4) + 0.001;
        // bloomPass.strength = 1.5 + Math.pow(HAPPENINGNESS, 4) * 2;
        // bloomPass.radius = 0.01 + 0.03 * Math.pow(HAPPENINGNESS, 4);
        // blurPass.uniforms['maxblur'].value = 0.2 * Math.pow(HAPPENINGNESS, 4);

        composer.render();

        let mouseoverData = ``;
        if (intersections.length > 0) {
            let uuid = intersections[0].object.uuid;
            mouseoverData = `UUID: ${uuid}, instanceId: ${intersections[0].instanceId}`;
            if (uuid in MESH_UUID_BALL_DICT) {
                let ball;
                if (intersections[0].instanceId !== undefined) {
                    // Instance mesh.
                    ball = MESH_UUID_BALL_DICT[intersections[0].object.uuid][intersections[0].instanceId];
                } else {
                    ball = MESH_UUID_BALL_DICT[intersections[0].object.uuid];
                }
                mouseoverData = `Ball [${ball.harmCoords}] ${ball.stepsFromA} edosteps`;
                copyText = ball.harmCoords.coords.join(', ');
            }
        }
        document.getElementById('text').innerText =
            `
            ${VERSION}    ${window.FPS.toFixed(0)} fps
            center: ${cameraObject.center.x.toFixed(1)}, ${cameraObject.center.y.toFixed(1)}, ${cameraObject.center.z.toFixed(1)}, rot: ${cameraObject.theta.toFixed(2)}, ${cameraObject.phi.toFixed(2)}, dist: ${cameraObject.dist.toFixed(0)}
            b: ${ballManager.numBallsAlive}/${ballManager.numBallObjects}, perm: ${ballManager.numPermaDead}, part: ${particleFountain.numParticles}
            hap: ${HAPPENINGNESS.toFixed(3)}, std: ${ballManager.stdDeviation.toFixed(1)}
            stm: ${harmonicContext.shortTermMemory.length} / ${MAX_SHORT_TERM_MEMORY}, dis: ${harmonicContext.dissonance.toFixed(4)} / ${harmonicContext.effectiveMaxDiss.toFixed(4)}
            ${harmonicContext.effectiveOrigin.toMonzoString()} ⟶ ${harmonicContext.effectiveOriginNoteName.toString()}
            ${mouseoverData}
            harmctx: ${HARMONIC_CONTEXT_METHOD}
            ${harmonicContext.toVeryNiceDisplayString()}
            `.trim();
        // document.getElementById('text').innerText = `${harmonicContext.toVeryNiceDisplayString()}`
    }

}

document.addEventListener('click', (event) => {
    if (copyText.length > 0) {
        navigator.clipboard.writeText(copyText);
    }
});

animate();

let _generateRandom = null;

function startRandom() {
    let r = 0;
    _generateRandom = setInterval(() => {
        r += Math.floor(Math.random() * 13) - 6;
        testOn(r);
        let offNote = r;
        setTimeout(() => {
            testOff(offNote);
        }, 1000)
    }, 80);
}

function stopRandom() {
    clearInterval(_generateRandom);
}

window.startRandom = startRandom;
window.stopRandom = stopRandom;

/**
 * Test the first N axes/prime intervals.
 * @param {number} N
 */
function testAxes(N) {
    let arr = [1];
    testOn(0, [0]);
    for (let i = 1; i < N; i++) {
        testOn(i, arr);
        arr.unshift(0);
    }
}

window.testAxes = testAxes;
