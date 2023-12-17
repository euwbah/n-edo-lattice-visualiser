// This dict only contains notes that are currently being sounded.

import { NOTE_ON_HAPPENINGNESS, RESET_TIME_SECS, addHappeningness } from "./configs.js";
import { HarmonicContext } from "./harmonic-context.js";
import { ScaffoldingManager, BallsManager } from "./drawn-objects.js";
import { HarmonicCoordinates } from "./just-intonation.js";
import { IS_RECORDING, RECORDED_NOTES, RecNote } from "./recording.js";

/**
 * KVP of [stepsFromA, {@linkcode KeyState}]
 *
 * @type {Object.<number, KeyState>}
 */
export let KEYS_STATE = {};
window.keysState = KEYS_STATE;
export let SUSTAIN_STATE = false;

export class KeyState {
    constructor(stepsFromA, vel) {
        this.stepsFromA = stepsFromA;
        this.vel = vel;
        this.fromSustainPedal = false;
    }
}

let clearHarmonicContextTimeoutID = null;

export function countExistingKeysState() {
    let held = 0, sustained = 0;
    for (let [_, v] of Object.entries(KEYS_STATE)) {
        if (v.fromSustainPedal)
            sustained++;
        else
            held++;
    }

    return [held, sustained];
}

/**
 * Stores the epoch time (ms) of the first note of the recording.
 *
 * @type {number}
 */
let recStartTime = 0;

/**
 *
 * @param {number} stepsFromA
 * @param {number} vel
 * @param {HarmonicContext} harmonicContext
 * @param {BallsManager} ballManager
 * @param {ScaffoldingManager} scaffoldingManager
 * @param {number[]?} explicitCoords When {@linkcode HARMONIC_CONTEXT_METHOD} is `12ji`, this array is used as the
 * explicit JI coordinates for the new ball. This should be `null`/unspecified if not in `12ji` mode.
 */
export function noteOn(stepsFromA, vel, harmonicContext, ballManager, scaffoldingManager, explicitCoords = null) {
    // console.log('received note on: ', stepsFromA, vel);
    addHappeningness(NOTE_ON_HAPPENINGNESS * Math.pow(vel/127, 1.5) + 0.002);
    if (clearHarmonicContextTimeoutID !== null) {
        clearTimeout(clearHarmonicContextTimeoutID);
        clearHarmonicContextTimeoutID = null;
    }
    KEYS_STATE[stepsFromA] = new KeyState(stepsFromA, vel);

    let [fromPitch, relativeRatio] = harmonicContext.registerNote(stepsFromA, explicitCoords);
    if (fromPitch === null) {
        // the harmonic context is fresh.
        ballManager.noteOn(relativeRatio, stepsFromA, vel);

        if (IS_RECORDING) {
            if (RECORDED_NOTES.length === 0) {
                recStartTime = Date.now();
            }
            RECORDED_NOTES.push(new RecNote(Date.now() - recStartTime, stepsFromA, relativeRatio));
        }
    } else {
        let absoluteRatio = fromPitch.absoluteRatio.add(relativeRatio); // the absolute interval of new ball
        let newBall = ballManager.noteOn(absoluteRatio, stepsFromA, vel);
        scaffoldingManager.create(fromPitch.absoluteRatio, newBall);

        if (IS_RECORDING) {
            if (RECORDED_NOTES.length === 0) {
                recStartTime = Date.now();
            }
            RECORDED_NOTES.push(new RecNote(Date.now() - recStartTime, stepsFromA, absoluteRatio));
        }
    }
}

export function startOriginResetTimer() {
    if (Object.keys(KEYS_STATE).length === 0 && clearHarmonicContextTimeoutID === null) {
        clearHarmonicContextTimeoutID = setTimeout(() => {
            harmonicContext.reset();
            clearHarmonicContextTimeoutID = null;
        }, RESET_TIME_SECS * 1000);
    }
}

export function noteOff(stepsFromA, vel) {
    // console.log('received note off: ', stepsFromA, vel);
    if (SUSTAIN_STATE) {
        KEYS_STATE[stepsFromA].fromSustainPedal = true;
    } else {
        delete KEYS_STATE[stepsFromA];
    }

    startOriginResetTimer();
}

export function offAll() {
    if (clearHarmonicContextTimeoutID !== null) {
        clearTimeout(clearHarmonicContextTimeoutID);
        clearHarmonicContextTimeoutID = null;
    }
    KEYS_STATE = {};
    harmonicContext.reset();
}

window.offAll = offAll;

export function cc(cc, value) {
    // console.log('received cc: ', cc, value);
    if (cc === 64) {
        // for expensive sustain pedals, sustain ranges from 0 to 127 (half pedalling is a thing)
        // make sure that the threshold below is appropriate.
        SUSTAIN_STATE = value >= 70;
        if (!SUSTAIN_STATE) {
            let sustainedNotes = Object.entries(KEYS_STATE).filter(
                ([_,keyState]) => keyState.fromSustainPedal
            ).map(([stepsFromA,_]) => stepsFromA);

            for (let x of sustainedNotes) {
                delete KEYS_STATE[x];
            }
            startOriginResetTimer();
        }
    }
}
