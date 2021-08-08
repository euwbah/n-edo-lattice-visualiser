// This dict only contains notes that are currently being sounded.
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
        let absoluteRatio = fromPitch.functioningAs.add(relativeRatio);
        let newBall = ballManager.noteOn(absoluteRatio, stepsFromA, vel);
        scaffoldingManager.create(fromPitch.functioningAs, newBall);
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
        }, 10000);
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