// This dict only contains notes that are currently being sounded.
/**
 * @type {Object.<number, KeyState>}
 */
let KEYS_STATE = {};
let SUSTAIN_STATE = false;

class KeyState {
    constructor(stepsFromA, vel) {
        this.stepsFromA = stepsFromA;
        this.vel = vel;
        this.fromSustainPedal = false;
    }
}

let clearHarmonicContextTimeoutID = null;

function countExistingKeysState() {
    let held = 0, sustained = 0;
    for (let [k, v] of Object.entries(KEYS_STATE)) {
        if (v.fromSustainPedal)
            sustained++;
        else
            held++;
    }

    return [held, sustained];
}

/**
 *
 * @param {number} stepsFromA
 * @param {number} vel
 * @param {HarmonicContext} harmonicContext
 * @param {BallsManager} ballManager
 * @param {ScaffoldingManager} scaffoldingManager
 */
function noteOn(stepsFromA, vel, harmonicContext, ballManager, scaffoldingManager) {
    // console.log('received note on: ', stepsFromA, vel);
    addHappeningness(NOTE_ON_HAPPENINGNESS * Math.pow(vel/127, 1.5) + 0.01);
    if (clearHarmonicContextTimeoutID !== null) {
        clearTimeout(clearHarmonicContextTimeoutID);
        clearHarmonicContextTimeoutID = null;
    }
    KEYS_STATE[stepsFromA] = new KeyState(stepsFromA, vel);

    let [fromPitch, relativeRatio] = harmonicContext.registerNote(stepsFromA);
    if (fromPitch === null) {
        // the harmonic context is fresh.
        ballManager.noteOn(relativeRatio, stepsFromA, vel);
    } else {
        let absoluteRatio = fromPitch.absoluteRatio.add(relativeRatio);
        let newBall = ballManager.noteOn(absoluteRatio, stepsFromA, vel);
        scaffoldingManager.create(fromPitch.absoluteRatio, newBall);
    }
}

function noteOff(stepsFromA, vel) {
    // console.log('received note off: ', stepsFromA, vel);
    if (SUSTAIN_STATE) {
        KEYS_STATE[stepsFromA].fromSustainPedal = true;
    } else {
        delete KEYS_STATE[stepsFromA];
    }

    // If no notes for 10 seconds, reset harmonic context to prevent intervals from getting out of hand.
    if (Object.keys(KEYS_STATE).length === 0 && clearHarmonicContextTimeoutID === null) {
        clearHarmonicContextTimeoutID = setTimeout(() => {
            harmonicContext.reset();
            clearHarmonicContextTimeoutID = null;
        }, RESET_TIME_SECS * 1000);
    }
}

function cc(cc, value) {
    // console.log('received cc: ', cc, value);
    if (cc === 64) {
        SUSTAIN_STATE = value >= 64;
        if (!SUSTAIN_STATE) {
            let sustainedNotes = Object.entries(KEYS_STATE).filter(
                ([_,keyState]) => keyState.fromSustainPedal
            ).map(([stepsFromA,_]) => stepsFromA);

            for (let x of sustainedNotes) {
                delete KEYS_STATE[x];
            }
        }
    }
}