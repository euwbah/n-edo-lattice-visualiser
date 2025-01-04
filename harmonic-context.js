import { CONSONANCE_THRESH_N_NOTES, CONSONANCE_THRESHOLD, DRAW_COORDS, EDO, FASTEST_KEY_CHANGE_SECS, HARMONIC_CONTEXT_METHOD, HIGHEST_REL_P2_DENOM, HIGHEST_REL_P3_DENOM, LIST_OF_PRIMES, MAX_DISS_N_NOTES, MAX_DISSONANCE, MAX_DURATION_BEFORE_FORGET_SECS, MAX_DURATION_BEFORE_FORGET_SECS_SUSTAINED, MAX_FATIGUE_SECS, MAX_HARMONIC_DISTANCE, MAX_NEW_NOTES_BEFORE_FORGET, MAX_SHORT_TERM_MEMORY, NUM_ROOT_CANDIDATES, PRIME_OCTAVE_LOOKUP, TARGET_TONICITY_UPDATE_NEW_NOTE_TIME, TARGET_TONICITY_UPDATE_TIME, USE_OCTAVE_REDUCED_PRIMES } from "./configs.js";
import { calculateDissonance, findOffenderGraph, quickGraphDiss, selectCandidate, updateTonicity } from "./dissonance-wasm/dissonance_wasm.js";
import { mod } from "./helpers.js";
import { EDOSTEPS_TO_FIFTHS_MAP, HarmonicCoordinates, convertStepsToPossibleCoord } from "./just-intonation.js";
import { KEYS_STATE } from "./note-tracking.js";

export class Pitch {
    /**
     * This value corresponds to edosteps of the pitch from A4 as per {@linkcode EDO} config.
     *
     * If running in `12ji` mode, this value is treated as 12 EDO, but is just an arbitrary step to keep track of which
     * note information was sent by which midi key.
     *
     * @type {number}
     */
    stepsFromA;
    /**
     * Absolute harmonic coordinates from 1/1
     *
     * @type {HarmonicCoordinates}
     */
    absoluteRatio;
    /**
     * Exact frequency of the original pitch (tempered if {@linkcode EDO} = 22/31 or JI if in `12ji` {@linkcode HARMONIC_CONTEXT_METHOD} mode)
     * @type {number}
     */
    frequency;
    /**
     * The 'parent node' {@linkcode Pitch}. The each pitch coordinate is a node in a tree data structure, and the parent
     * pitch is where scaffolding is drawn from.
     *
     * For detemperaments (non-`12ji` {@linkcode HARMONIC_CONTEXT_METHOD}), this denotes which existing pitch in pitch memory
     * this new pitch is best heard relative to, i.e. `bestFitRelativeNote` in code below.
     *
     * Otherwise, when no detempering is done, this should just be the nearest node (in terms of L2-norm) to the
     * this new pitch, so that minimal scaffolding can be drawn.
     *
     * @type {Pitch}
     */
    parent;
    /**
     * Harmonic coordinates relative to {@linkcode parent}
     *
     * @type {HarmonicCoordinates}
     */
    relativeRatio;
    /**
     * A pitch gets struck out once when a new note enters the pitch memory
     * Octaves of existing notes are not regarded as new notes.
     * @type {number}
     */
    strikeCounter = 0;
    /**
     * Stores the epoch time this note was most recently played.
     *
     * @type {Date}
     */
    noteOnTime;

    /**
     * The relative tonicity of this pitch, symbolizing how likely this note is to be perceived as
     * tonic amongst all notes (sum of all tonicity scores in short term memory should be 1 at all
     * times)
     *
     * Applicable for 'graph' | 'graphdist' harmonic context method.
     *
     * @type {number?}
     */
    tonicity = null;

    /**
     * The average dissonance contribution per traversal that starts from this note for 'graph'
     * harmonic context method.
     * @type {number}
     */
    dissContribution = 0;

    constructor(stepsFromA, parent, relativeRatio, tonicity = null) {
        this.stepsFromA = stepsFromA;
        this.frequency = 440 * 2 ** (stepsFromA / EDO);
        this.parent = parent;
        this.relativeRatio = relativeRatio;
        this.noteOnTime = new Date();
        if (parent)
            this.absoluteRatio = this.parent.absoluteRatio.add(this.relativeRatio);
        else {
            this.absoluteRatio = this.relativeRatio;
            this.parent = null;
        }
        this.tonicity = tonicity;
    }
}

/**
 * Note names are stored as Harmonic Coordinates from A4, and displayed as HEWM notation.
 *
 * The effective origin will be given an absolute note name, based on the
 * {@linkcode Pitch.stepsFromA} of the closest {@linkcode Pitch} to the effective origin (in terms
 * of harmonic distance). Note names of pitches are relative to the
 * {@linkcode HarmonicContext.effectiveOrigin}.
 *
 * E.g., assume USE_OCTAVE_REDUCED_PRIMES is true. The effective origin is currently at [-1, 0, 3] =
 * 125/128. The closest {@linkcode Pitch} to the effective origin is [-1, 1, 3] = 375/256, which has
 * `stepsFromA` = 3 (C5). The note C5 has the default NoteName of [2, -3]. Then, the effective
 * origin will be given the note name F4 based on the relative difference: [2, -3] + ([-1, 0, 3] -
 * [-1, 1, 3]) = [2, -4].
 *
 * Then, every other Pitch will be relative to F4 [2, -4] and the effective origin [-1, 0, 3]:
 *
 * E.g., [-1, 0, 2] relative to [-1, 0, 3] is [0, 0, 1]. Then we add the origin's note name [2, -4]
 * to get [2, -4, 1] = A-4 (the minus sign means lowering by the 81/80 comma).
 */
export class NoteName extends HarmonicCoordinates {
    /**
     * The absolute harmonic coordinates relative to A4, which gives the name of this note.
     *
     * @type {HarmonicCoordinates}
     * @override
     */
    get coords() { return this._coords; };

    /**
     * Cached string representation of the note name.
     * @type {string?}
     */
    #stringRepresentation = null;

    /**
     * @param {HarmonicCoordinates | [number]} coords The absolute harmonic coordinates relative
     * to the note A4 (i.e., HarmonicCoordinate [0] will be called A4 itself), from which the note
     * name will be calculated from.
     */
    constructor(coords) {
        super(coords);
    }

    /**
     * The note name in HEWM notation.
     *
     * @type {string}
     */
    toString() {
        if (this.#stringRepresentation !== null) {
            return this.#stringRepresentation;
        }
        /**
        Note names are calculated based on octave, nominal, and accidentals.

        There is a one-to-one mapping between {@linkcode HarmonicCoordinates} and the name of the
        note in {@linkcode toString}

        Each prime interval contributes a standardized amount to the octave and nominal.

        Octaves: 2/1

        The octave prime interval is trivial, and is an Abelian group with respect to addition.

        Fifths: 3/2 (or 3/1 if not USE_OCTAVE_REDUCED_PRIMES, we have to add/subtract an octave for
        every fifth if so)

        Fifths follow a modulo 7 pattern of nominals: FCGDAEB. After B it loops back to F but we add
        a sharp, before F, it loops around to B but we add a flat.

        It appears that every two fifths we go up an octave. However, one thing that is tricky is
        that the fifth between any F nominal to C nominal, regardless of accidental, will add an
        octave.

        Fb-1  Cb0  Gb0  Db1  Ab1  Eb2   Bb2

        F3    C4   G4   D5   A5   E6    B6

        F#7   C#8  G#8  D#9  A#9  E#10  B#10

        Fx11  Cx12 Gx12 Dx13 Ax13 Ex14  Bx14

        Notice the pattern of octaves. If we count the number of octaves added by stacking fifths
        starting from A, we get:

        0  1  1  2  3  3  4

        4  5  5  6  7  7  8

        8  9  9  10 11 11 12

        This motivates this lookup table for converting fifths to octaves:
         */
        const FIFTH_OCTAVE_LOOKUP = [0, 1, 1, 2, 3, 3, 4];
        const FIFTH_NOMINAL_LOOKUP = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];

        /**
         * We can obtain the octave offset of N fifths from the nominal A by integer dividing N by 7
         * and multiplying by 4, then adding the offset by the N modulo 7 from the lookup table.
         *
         * This assumes USE_OCTAVE_REDUCED_PRIMES is true. If not, we have to add/subtract an octave
         * for every fifth up/down.
         */
        let fifthsOctaveOffset = (fifthsFromA) => {
            return 4 * Math.floor(fifthsFromA / 7) + FIFTH_OCTAVE_LOOKUP[mod(fifthsFromA, 7)];
        }

        /**
         * Converts number of fifths from A to a nominal + pythagorean accidental string.
         *
         * E.g., `calcNomPyth(0) == 'A'`, `calcNomPyth(4) == 'F♯'`, `calcNomPyth(-12) == 'B𝄫'`
         * @param {number} fifthsFromA The number of fifths from A.
         * @returns A string containing the nominal and pythagorean accidentals of the note.
         */
        let calcNomPyth = (fifthsFromA) => {
            let nom = FIFTH_NOMINAL_LOOKUP[mod(fifthsFromA + 4, 7)];
            let numSharps = Math.floor((fifthsFromA + 4) / 7);
            let numPyth = Math.abs(numSharps);
            let doublePythAcc = numSharps < 0 ? '𝄫' : 'x';
            let singlePythAcc = numSharps < 0 ? '♭' : '♯';

            let pythAcc = '';
            while (numPyth >= 2) {
                pythAcc += doublePythAcc;
                numPyth -= 2;
            }
            if (numPyth == 1) {
                pythAcc += singlePythAcc;
            }

            return `${nom}${pythAcc}`;
        }

        /*
         * Maj thirds: 5/4 (or 5/1)
         *
         * Dbb+++3     Fb++3       Ab+3
         *
         * C4          E-4         G#--4
         *
         * B#---4      Dx----5     Fx#-----5
         *
         * Ax#------5  Cxx-------6 Exx--------6
         *
         * where +/- denotes raising/lowering by the syntonic comma 81/80, the difference between
         * the pythagorean maj 3rd 81/64 and the 5-limit 5/4.
         *
         * The difficulty here is in knowing which octaves to use, as although technically three 5/4
         * thirds is almost an octave, the choice of octave number depends on the nominal.
         *
         * Notice however, if we define a major third as up 4 fifths, down 2 octaves, and down a
         * syntonic comma, we get, for example:
         *
         * From G#vv4, we go up 4 fifths to B#vv6, down 2 octaves to B#vv4, then down a syntonic
         * comma to B#vvv4, as expected.
         *
         * From B#vvv4, up 4 fifths to Dxvvv7, down 2 octaves to Dxvvv5, then down a syntonic comma
         * to Dxvvvv5, as expected.
         *
         * If not USE_OCTAVE_REDUCED_PRIMES, we add two more octaves for each major third.
         *
         * This neat way allows us to calculate the octave offset, nominal, and pythagorean
         * accidentals at the same time.
         *
         * Septimal seventh: 7/4 (or 7/1)
         *
         * Down 2 fifths, up 2 octaves, up a septimal comma (< for down, > for up, 64/63).
         *
         * If not USE_OCTAVE_REDUCED_PRIMES, we add/subtract two more octaves for every 7th up/down.
         *
         * Undecimal fourth: 11/8 (or 11/1)
         *
         * Down 1 fifth, up one octave, up an undecimal comma (v for down, ^ for up, 33/32). If not
         * octave reduced, add 3 more octaves.
         */

        /**
         * For the N-th prime, (first elem = 2, second elem = 3, etc..), each tuple contains:
         *
         * [
         *      Number of octaves contributed (octave reduced prime only),
         *      Fifths offset,
         *      Downward interval comma accidental (if any)
         *      Upward interval comma accidental (if any)
         * ]
         *
         * contributed octaves are counted in addition to the fifths, so the major third 5/4 would
         * be considered as contributing -2 octaves and 4 fifths.
         *
         * The comma accidentals are relative to the pitch going up/down, not the actual comma going
         * up or down.
         *
         * In an upwards major third, the comma goes down, so the upward accidental is '-' and the
         * downward accidental is '+'
         *
         * TODO: Extend this to include all the primes supported by HEWM.
         *
         * @type {[[number, number, number, string, string]]}
         */
        const PRIME_NOTATION_LOOKUP = [
            [1, 0, '', ''],      // 2
            [0, 1, '', ''],      // 3
            [-2, 4, '+', '-'],   // 5
            [2, -2, '>', '<'],   // 7
            [1, -1, 'v', '^'],   // 11
        ]


        let commaAccidentals = '';
        let octave = 4;
        let fifthsFromA4 = 0;

        // We add the comma accidentals from highest prime limit first to lowest.
        //
        // Any primes higher than the lookup will be ignored.

        for (let i = PRIME_NOTATION_LOOKUP.length - 1; i >= 0; i--) {
            let [octaveOffset, fifthsOffset, downAcc, upAcc] = PRIME_NOTATION_LOOKUP[i];

            if (!USE_OCTAVE_REDUCED_PRIMES) {
                octaveOffset += PRIME_OCTAVE_LOOKUP[LIST_OF_PRIMES[i]];
            }

            let numIntervals = this.coords[i] ?? 0;
            commaAccidentals += (numIntervals > 0 ? upAcc : downAcc).repeat(Math.abs(numIntervals));
            octave += octaveOffset * numIntervals;
            fifthsFromA4 += fifthsOffset * numIntervals;
        }

        let nominalAndPythAcc = calcNomPyth(fifthsFromA4);
        octave += fifthsOctaveOffset(fifthsFromA4);

        this.#stringRepresentation = `${nominalAndPythAcc}${commaAccidentals}${octave}`;
        return this.#stringRepresentation;
    }
}

/**
 * For each supported {@linkcode EDO}, a mapping of edosteps from A4 to {@linkcode NoteName} objects
 * which are relative to A4.
 *
 * The edosteps are modulo the octave A4 (inclusive) to A5 (exclusive), so the note names here will
 * be in the 4th and 5th octave (+0 and +1 octaves relative to A4).
 *
 * @type {{[number]: [NoteName]}}
 */
export const DEFAULT_NOTENAMES = (() => {
    let octaveReduced = {
        // Octave reduced primes.

        // 12 EDO is LsLLsLL from A (L = 2, s = 1, # = 1)
        12: [
            new NoteName([0]),      // A4
            new NoteName([3, -5]),  // Bb4
            new NoteName([-1, 2]),  // B4
            new NoteName([2, -3]),  // C5
            new NoteName([5, -8]),  // Db5
            new NoteName([1, -1]),  // D5
            new NoteName([4, -6]),  // Eb5
            new NoteName([0, 1]),   // E5
            new NoteName([3, -4]),  // F5
            new NoteName([6, -9]),  // Gb5
            new NoteName([2, -2]),  // G5
            new NoteName([5, -7]),  // Ab5
        ],

        // 22 EDO (pyth) is LsLLsLL from A (L = 4, s = 1, # = 3)
        22: [
            new NoteName([0]),              // A4
            new NoteName([3, -5]),          // Bb4
            new NoteName([2, -4, 0, 0, 1]), // Bb^4
            new NoteName([-4, 7]),          // A#4
            new NoteName([-1, 2]),          // B4
            new NoteName([2, -3]),          // C5
            new NoteName([5, -8]),          // Db5
            new NoteName([4, -7, 0, 0, 1]), // Db^5
            new NoteName([-2, 4]),          // C#5
            new NoteName([1, -1]),          // D5
            new NoteName([4, -6]),          // Eb5
            new NoteName([3, -5, 0, 0, 1]), // Eb^5
            new NoteName([-3, 6]),          // D#5
            new NoteName([0, 1]),           // E5
            new NoteName([3, -4]),          // F5
            new NoteName([6, -9]),          // Gb5
            new NoteName([5, -8, 0, 0, 1]), // Gb^5
            new NoteName([-1, 3]),          // F#5
            new NoteName([2, -2]),          // G5
            new NoteName([5, -7]),          // Ab5
            new NoteName([4, -6, 0, 0, 1]), // Ab^5
            new NoteName([-2, 5]),          // G#5
        ],

        // 31 EDO is LsLLsLL from A (L = 5, s = 3, # = 2)
        31: [
            new NoteName([0]),              // A4
            new NoteName([-1, 1, 0, 0, 1]), // A^4
            new NoteName([-4, 7]),          // A#4
            new NoteName([3, -5]),          // Bb4
            new NoteName([0, 1, 0, 0, -1]), // Bv4
            new NoteName([-1, 2]),          // B4
            new NoteName([6, -10]),         // Cb5
            new NoteName([3, -4, 0, 0, -1]),// Cv5
            new NoteName([2, -3]),          // C5
            new NoteName([1, -2, 0, 0, 1]), // C^5
            new NoteName([-2, 4]),          // C#5
            new NoteName([5, -8]),          // Db5
            new NoteName([2, -2, 0, 0, -1]),// Dv5
            new NoteName([1, -1]),          // D5
            new NoteName([0, 0, 0, 0, 1]),  // D^5
            new NoteName([-3, 6]),          // D#5
            new NoteName([4, -6]),          // Eb5
            new NoteName([1, 0, 0, 0, -1]), // Ev5
            new NoteName([0, 1]),           // E5
            new NoteName([7, -11]),         // Fb5
            new NoteName([4, -5, 0, 0, -1]),// Fv5
            new NoteName([3, -4]),          // F5
            new NoteName([2, -3, 0, 0, 1]), // F^5
            new NoteName([-1, 3]),          // F#5
            new NoteName([6, -9]),          // Gb5
            new NoteName([3, -3, 0, 0, -1]),// Gv5
            new NoteName([2, -2]),          // G5
            new NoteName([1, -1, 0, 0, 1]), // G^5
            new NoteName([-2, 5]),          // G#5
            new NoteName([5, -7]),          // Ab5
            new NoteName([2, -1, 0, 0, -1]),// Av5
        ]
    };

    if (USE_OCTAVE_REDUCED_PRIMES) {
        return octaveReduced;
    }

    // If we are not using octave reduced primes, we have to offset octaves:

    let noReduce = {};

    for (let [edo, noteNames] of Object.entries(octaveReduced)) {
        noReduce[edo] = noteNames.map(noteName => new NoteName(noteName.convOctReducedToAbs()));
    }

    return noReduce;
})();

export function testPrintDefaultNoteNames() {
    for (let [edo, noteNames] of Object.entries(DEFAULT_NOTENAMES)) {
        console.log(`EDO: ${edo}`);
        for (let i = 0; i < noteNames.length; i++) {
            console.log(`Note ${i}: ${noteNames[i].toString()}`);
        }
    }
}

/**
 * This function converts edosteps to a default {@linkcode NoteName} object.
 *
 * There are infinitely many enharmonic equivalaent ways to name one edostep, so the lookup table
 * {@linkcode DEFAULT_NOTENAMES} is used to choose a default note name (usually favouring flats over
 * sharps because parallel modal interchange will add sharps)
 *
 * @param {number} stepsFromA The number of edosteps from A4.
 * @returns {NoteName} The default note name for the given number of steps from A4.
 */
export function getDefaultNoteName(stepsFromA) {
    let lookup = DEFAULT_NOTENAMES[EDO];
    let octaveOffset = Math.floor(stepsFromA / EDO); // offset from the [A4, A5) interval
    let edostepModOctave = mod(stepsFromA, EDO);
    return lookup[edostepModOctave].add([octaveOffset]);
}

/**
 * The harmonic context represents the 'tonal center' for which all new notes will be judged with
 * respect to, and each addition of a new note will cause the harmonic centroid (i.e. the 'key
 * center') to update.
 */
export class HarmonicContext {
    /**
     * @type {[Pitch]}
     */
    shortTermMemory = [];

    /**
     * Stores the frequency of the absolute origin note 1/1. This is usually the first note played
     * in the session.
     * @type {number}
     */
    absoluteOriginFreq = 440;

    /**
     * Cached value of relative note tonicities ({@linkcode Pitch.tonicity}) in
     * {@linkcode shortTermMemory}.
     *
     * Updated every tick for 'graph'/'graphdist' harmonic context methods.
     * @type {[number]}
     */
    tonicityContext = [];

    /**
     * The pitch object that is closest to the {@linkcode effectiveOrigin} in terms of harmonic
     * distance. Currently, if not in graph/graphdist mode, this value is updated every time
     * {@linkcode effectiveOrigin} is updated ('key change') in {@linkcode updateStatistics}. In
     * graph mode, it is updated very often in {@linkcode tick}.
     *
     * The computation for this value in graph mode comes for free (since tonicity is updated every
     * tick), however for non-graph harmonic context methods, it may be expensive to recompute this
     * value every new note, hence it is only computed when {@linkcode effectiveOrigin} changes. If
     * it is too inaccurate, consider changing the implementation to update this value every new
     * note.
     *
     * Currently, for graph mode, the {@linkcode effectiveOrigin} is always in
     * {@link shortTermMemory}.
     * @type {Pitch}
     */
    pitchNearestToOrigin = null;

    /**
     * This is a pseudo harmonic coordinate with invalid non-integer coordinate values.
     *
     * Used to determine where the projected 'centroid' is for the camera to point towards.
     *
     * Used to calculate harmonic distance for {@linkcode HARMONIC_CONTEXT_METHOD} = `l2` mode.
     *
     * @type {HarmonicCoordinates}
     */
    #avgHc = new HarmonicCoordinates([0]);
    /**
     * In 2D proj, the third value is not used.
     */
    #tonalCenterUnscaledCoords = [0, 0, 0];

    /**
     * Most recently calculated dissonance score. Updated when {@linkcode updateStatistics} is called.
     *
     * In the new 'graph'/'graphdist' harmonic context method, this value is updated frequently in {@linkcode tick}.
     */
    #dissonance = 0;
    #effectiveMaxDiss = MAX_DISSONANCE;
    /**
     * A number ranging 0 to 1 representing the amount of dissonance fatigue.
     * @type {number}
     */
    #fatigue = 0;
    #maxHarmDist = 0;
    #meanHarmDist = 0;

    /**
     * See {@linkcode effectiveOrigin}
     * @type {HarmonicCoordinates}
     */
    #effectiveOrigin = new HarmonicCoordinates([0]);

    /**
     * See {@linkcode effectiveOriginNoteName}
     * @type {NoteName}
     */
    #effectiveOriginNoteName = getDefaultNoteName(0);

    /**
     * stores the last time the effective origin was changed so that a new effective origin will not
     * change so rapidly.
     * @type {Date}
     */
    #lastKeyChangeTime = new Date();

    /**
     * The mean fifth value (0 is A) of the notes in the shortTermMemory, rounded to the nearest
     * whole.
     * @type {number}
     */
    #centralFifth = 0;

    /**
     * Stores the last time the tonicity was updated. Used for the graph/graphdist harmonic context
     * mode.
     *
     * This value should reset to the present when the shortTermMemory goes from having 1 note to 2
     * notes, as updates can only happen when there are at least 2 notes in the short term memory.
     */
    #lastTonicityUpdateTime = new Date();

    /**
     * If true, a new note has been added and tonicity computation hasn't been performed in
     * {@linkcode tick} yet.
     */
    #newNoteBeforeTonicityComputation = false;

    /**
     * If {@linkcode HARMONIC_CONTEXT_METHOD} is 'draw', this value is the index of the next
     * coordinate to draw in {@linkcode DRAW_COORDS}
     */
    #drawIdx = 0;

    /**
     * The coordinate target to draw next.
     * @type {HarmonicCoordinates?}
     */
    #currDrawTarget = HARMONIC_CONTEXT_METHOD == 'draw' ? new HarmonicCoordinates(DRAW_COORDS[0]) : null;

    /**
     * The previous coordinate target that should currently be in {@linkcode shortTermMemory}. If in
     * draw mode, the shortTermMemory pitch with this coordinate will not go away.
     *
     * @type {HarmonicCoordinates?}
     */
    #prevDrawTarget = null;

    /**
     * If true, a graph based {@linkcode HARMONIC_CONTEXT_METHOD} is currently in use.
     *
     * 'graph', 'graphdist', 'draw' are graph based methods.
     */
    #graphHCM = false;

    constructor() {
        if (HARMONIC_CONTEXT_METHOD == 'graph' || HARMONIC_CONTEXT_METHOD == 'graphdist' || HARMONIC_CONTEXT_METHOD == 'draw') {
            this.#graphHCM = true;
        }
    }

    /**
     * Retrieves the frequency of the effective origin's 1/1 relative to the absolute 1/1.
     * @type {number}
     */
    get effectiveOriginFreq() {
        return this.#effectiveOrigin.toFrequency(this.absoluteOriginFreq);
    }

    /**
     * Dissonance score as per WASM dissonance calculations, evaluated every time
     * {@linkcode updateStatistics} is called, or updated during {@linkcode tick} for
     * 'graph'/'graphdist' harmonic context method.
     *
     * Calculates the dissonance of all the notes in the {@linkcode shortTermMemory}.
     */
    get dissonance() {
        return this.#dissonance;
    }

    get effectiveMaxDiss() {
        return this.#effectiveMaxDiss;
    }

    /**
     * A number ranging 0 to 1 representing the amount of dissonance fatigue.
     * @type {number}
     */
    get fatigue() {
        return this.#fatigue;
    }

    get maxHarmonicDistance() {
        return this.#maxHarmDist;
    }

    get meanHarmonicDistance() {
        return this.#meanHarmDist;
    }

    /**
     * a 3D vector representing coords of the tonal center.
     * NOTE: tonal center is calculated using `#avcHc` not `#effectiveOrigin`.
     *
     * `[x, y, z]`
     *
     * @type {number[]}
     */
    get tonalCenterUnscaledCoords() {
        return this.#tonalCenterUnscaledCoords;
    }

    get stmFrequencies() {
        return this.shortTermMemory.map(x => x.frequency);
    }

    /**
     * A false origin chosen such that the ratios (w.r.t. effectiveOrigin) of the notes on screen is
     * as simple as possible (minimal monzo numbers). Also used to calculate harmonic distance for
     * {@linkcode HARMONIC_CONTEXT_METHOD} `l2eo` mode.
     *
     * NOTE: The 3D centroid (this.#tonalCenterUnscaledCoords) of the Harmonic Context structure is
     * not determined with this method, instead it is determined using the standard centroid
     * algorithm: the mean of each axis of each pitch in the harmonic context.
     *
     * The difference between this `effectiveOrigin` and the centroid HarmonicCoordinates is that
     * the effectiveOrigin has it's harmonic coordinates rounded to the nearest whole number.
     *
     * For the 'graph'/'graphdist' harmonic context method, this is a heuristic value for the 'tonic' note that
     * should appear as 1/1.
     * @type {HarmonicCoordinates}
     */
    get effectiveOrigin() {
        return this.#effectiveOrigin;
    }

    /**
     * This is the {@linkcode NoteName} of the {@linkcode effectiveOrigin}, calculated based on the
     * {@linkcode pitchNearestToOrigin}. This is updated every time the effective origin is moved.
     */
    get effectiveOriginNoteName() {
        return this.#effectiveOriginNoteName;
    }

    get centralFifth() {
        return this.#centralFifth;
    }

    tick() {
        let now = new Date();

        let timeSinceLastTonicityUpdate = now - this.#lastTonicityUpdateTime; // in ms
        if (this.#graphHCM &&
            ((!this.#newNoteBeforeTonicityComputation && timeSinceLastTonicityUpdate > TARGET_TONICITY_UPDATE_TIME)
                || (this.#newNoteBeforeTonicityComputation && timeSinceLastTonicityUpdate > TARGET_TONICITY_UPDATE_NEW_NOTE_TIME))) {
            let updateDelta = (now - this.#lastTonicityUpdateTime) / 1000;
            this.#lastTonicityUpdateTime = now;
            this.#newNoteBeforeTonicityComputation = false;

            if (this.shortTermMemory.length >= 2) {
                let results = Array.from(updateTonicity(
                    this.shortTermMemory.map(pitch => pitch.absoluteRatio.toFrequency(this.absoluteOriginFreq)),
                    this.tonicityContext,
                    updateDelta
                ));
                this.tonicityContext = results.slice(0, this.shortTermMemory.length);
                this.shortTermMemory.forEach((pitch, idx) => {
                    pitch.tonicity = this.tonicityContext[idx];
                    pitch.dissContribution = results[idx + this.shortTermMemory.length];
                });
                this.#dissonance = results[results.length - 1];

                // If max dissonance exceeded, remove one note per tick until
                // dissonance falls back below threshold.

                if (this.dissonance > this.effectiveMaxDiss) {
                    let idxToRemove = findOffenderGraph(this.stmFrequencies, this.tonicityContext);
                    if (HARMONIC_CONTEXT_METHOD == 'draw' && this.shortTermMemory[idxToRemove].absoluteRatio.equals(this.#prevDrawTarget)) {
                        let idxOfDrawnNote = idxToRemove;
                        // Don't remove the drawn note from harmonic context. Instead, remove the note with lowest tonicity.
                        idxToRemove = -1;
                        let lowestTonicity = Infinity;
                        this.tonicityContext.forEach((t, idx) => {
                            if (t < lowestTonicity && idx != idxOfDrawnNote) {
                                idxToRemove = idx;
                                lowestTonicity = t;
                            }
                        })
                    }
                    this.removePitchAtIdx(idxToRemove);
                }

                let highestTonicityPitch = this.shortTermMemory.reduce((prev, curr) => {
                    if (prev === null) return curr;
                    if (curr.tonicity > prev.tonicity) return curr;
                    return prev;
                });

                // TODO: If several pitches are very close in tonicity, do some heuristic to figure
                // out if there is a way to average out the tonicity. Right now we are assuming that
                // the tonic will always be in the short term memory, which makes things easy for
                // finding the NoteName of the effective origin, but this may not be true (?)
                this.#effectiveOrigin = highestTonicityPitch.absoluteRatio;
                this.pitchNearestToOrigin = highestTonicityPitch;
                this.#effectiveOriginNoteName = getDefaultNoteName(highestTonicityPitch.stepsFromA);
            }
        }

        /** The maximum dissonance before notes must be removed from {@link shortTermMemory} */
        let maxDiss = MAX_DISS_N_NOTES[this.shortTermMemory.length] ?? MAX_DISSONANCE;
        /** If dissonance exceeds this consonance threshold, fatigue starts to increase */
        let consThresh = CONSONANCE_THRESH_N_NOTES[this.shortTermMemory.length] ?? CONSONANCE_THRESHOLD;

        if (this.dissonance > consThresh) {
            let df = deltaTime / 1000 / MAX_FATIGUE_SECS * (this.dissonance - consThresh) / (maxDiss - consThresh);
            this.#fatigue = Math.min(1, this.fatigue + df);
        } else {
            // Fatigue recovers at least twice as fast.
            let df = deltaTime / 1000 / MAX_FATIGUE_SECS;
            this.#fatigue = Math.max(0, this.fatigue - df * 2);
        }
        this.#effectiveMaxDiss = consThresh + (maxDiss - consThresh) * (1 - this.fatigue);

        this.#tonalCenterUnscaledCoords = this.#avgHc.toUnscaledCoords();

        // forget notes that are very old.

        for (let i = 0; i < this.shortTermMemory.length; i++) {
            let p = this.shortTermMemory[i];
            let keystate = KEYS_STATE[p.stepsFromA]; // use this to determine whether/when forgetting should occur.
            if ((HARMONIC_CONTEXT_METHOD != 'draw' || !p.absoluteRatio.equals(this.#prevDrawTarget)) &&
                ((!keystate && now - p.noteOnTime > MAX_DURATION_BEFORE_FORGET_SECS * 1000)
                    || (keystate && keystate.fromSustainPedal
                        && now - p.noteOnTime > MAX_DURATION_BEFORE_FORGET_SECS_SUSTAINED * 1000))) {
                this.removePitchAtIdx(i);
                i--;
            }
        }
    }

    /**
     * Removes the oldest note from {@linkcode shortTermMemory} (in terms of {@linkcode Pitch.noteOnTime})
     */
    removeOldest() {
        let oldestIdx = -1;
        for (let i = 0; i < this.shortTermMemory.length; i++) {
            if (HARMONIC_CONTEXT_METHOD == 'draw' && this.shortTermMemory[i].absoluteRatio.equals(this.#prevDrawTarget))
                continue;
            if (oldestIdx == -1) {
                oldestIdx = i;
                continue;
            }

            if (this.shortTermMemory[i].noteOnTime < this.shortTermMemory[oldestIdx].noteOnTime) {
                oldestIdx = i;
            }
        }

        if (oldestIdx != -1) {
            this.removePitchAtIdx(oldestIdx);
        }
    }

    /**
     * Removes a note from {@linkcode shortTermMemory} by index by splicing. Also removes the
     * corresponding tonicity value in {@linkcode tonicityContext} if in 'graph'/'graphdist' mode
     * and rescales the tonicities to sum to 1.
     *
     * @param {number} idx Index of the note to remove from {@linkcode shortTermMemory}
     */
    removePitchAtIdx(idx) {
        if (idx < 0 || idx >= this.shortTermMemory.length) {
            console.warn(`Invalid call to removePitchAtIdx with index ${idx}`);
            console.trace();
        }
        this.shortTermMemory.splice(idx, 1);
        if (HARMONIC_CONTEXT_METHOD == 'graph' || HARMONIC_CONTEXT_METHOD == 'graphdist' || HARMONIC_CONTEXT_METHOD == 'draw') {
            let removedTonicity = this.tonicityContext.splice(idx, 1)[0];
            this.tonicityContext.forEach((t, idx) => {
                this.tonicityContext[idx] = t / (1 - removedTonicity);
                this.shortTermMemory[idx].tonicity = this.tonicityContext[idx];
            });
        }
    }

    nextDrawTarget() {
        if (this.#currDrawTarget === null) {
            return;
        }

        this.#prevDrawTarget = this.#currDrawTarget;
        this.#drawIdx += 1;
        if (this.#drawIdx >= DRAW_COORDS.length) {
            this.#currDrawTarget = null;
        } else {
            this.#currDrawTarget = new HarmonicCoordinates(DRAW_COORDS[this.#drawIdx]);
        }
    }

    /**
     * Register a new note from noteOn event, performing detempering calculations.
     *
     * @param stepsFromA The edosteps from A of the note to add. If `12ji` mode, this should be used
     * to distinguish between distinct MIDI notes.
     *
     * @param vel The velocity of the note to add.
     *
     * @param coords {number[]?} absolute harmonic coordinate vector (Monzo) of this note to add,
     * specify if and only if {@linkcode HARMONIC_CONTEXT_METHOD} is `12ji`.
     *
     * @returns {[?Pitch, HarmonicCoordinates, boolean]} A triple (parent {@linkcode Pitch}, best
     * fit interval relative to parent, drawNote) containing the parent pitch referenced in short
     * term memory and the relative interval between the parent pitch and the new pitch. If the
     * HarmonicContext is completely empty, the parent pitch will be null, and the 'relative
     * interval' is absolute with respect to the origin 1/1. The last item `drawNote` is true if
     * {@linkcode HARMONIC_CONTEXT_METHOD} is `draw` and the note added is a target drawn note that
     * should be permanent.
     */
    registerNote(stepsFromA, vel, coords = null) {
        if (this.shortTermMemory.length === 0) {
            // 1. Empty short term memory, add first note as 1/1 (unless explicit coords or draw mode)
            // If explicit coords, the first note will be the absolute value of the coords.
            // If in draw mode, if shortTermMemory is empty, the first note will be #currDrawTarget.
            /** @type {HarmonicCoordinates} */
            let harmonicCoordinates;
            if (HARMONIC_CONTEXT_METHOD == 'draw') {
                harmonicCoordinates = this.#currDrawTarget;
                this.nextDrawTarget();
            } else {
                harmonicCoordinates = new HarmonicCoordinates(coords ?? [0]);
            }
            if (this.#graphHCM) {
                this.shortTermMemory.push(new Pitch(stepsFromA, null, harmonicCoordinates, 1));
                this.tonicityContext.push(1);
            } else {
                this.shortTermMemory.push(new Pitch(stepsFromA, null, harmonicCoordinates));
            }

            if (coords === null) {
                this.absoluteOriginFreq = 440 * 2 ** (stepsFromA / EDO);
            } else {
                this.absoluteOriginFreq = 440; // TODO: check if it is safe to assume 1/1 is 440 Hz in 12ji mode.
            }

            this.#effectiveOriginNoteName = getDefaultNoteName(stepsFromA);
            this.#effectiveOrigin = harmonicCoordinates;
            this.pitchNearestToOrigin = this.shortTermMemory[0];
            return [null, harmonicCoordinates, HARMONIC_CONTEXT_METHOD == 'draw'];
        }

        if (this.shortTermMemory.length === 1) {
            // going to 2 notes, reset the tonicity update time.
            this.#lastTonicityUpdateTime = new Date();
        }

        // 2. else find candidate possible correlation by brute forcing all the different ways
        // the new note can relate to the existing notes in the short term memory.

        /**
         * The preferred note that the ratio is relative to/constructed from.
         * @type {?Pitch}
         */
        let bestFitRelativeFrom = null;
        /**
         * the preferred perceived relative ratio between the `bestFitRelativeNote` and the new registered note.
         * @type {?HarmonicCoordinates}
         */
        let bestFitRatio = null;

        /**
         * The `bestFitRatio` with absolute coordinates relative to origin.
         * @type {?HarmonicCoordinates}
         */
        let newAbsRatio = null;

        /**
         * true if the new pitch is an octave of an existing pitch.
         * @type {boolean}
         */
        let newPitchIsOctaveOfExistingPitches = this.containsOctavesOfNote(stepsFromA);

        /**
         * if newAbsRatio is equal to some existing pitch in the short term memory,
         * this will be a reference to that pitch.
         * @type {Pitch?}
         */
        let existingPitch = null;

        /**
         * If true, the new or existing note is currently the draw target, and has just been drawn.
         * @type {boolean}
         */
        let drawNote = false;

        if (HARMONIC_CONTEXT_METHOD == 'cb') {
            // note that the existing notes in the short term memory will all be set to
            // fixed tempered, quantized N edo pitches, but the note in question will be tested in just intonation
            // with respect to each of the existing quantized pitches to solve the ambiguity of the harmonic function
            // of the newly added note.

            let stmFreqs = this.stmFrequencies;

            // this structure is used to map the wasm result back into
            // js objects.
            let candidates_pitches = [];

            for (let pitch of this.shortTermMemory) {
                let candidateRatios = convertStepsToPossibleCoord(stepsFromA - pitch.stepsFromA);
                let freqArrays = [];
                for (let r of candidateRatios) {
                    // consider just intonated interval relative to tempered/original pitch in STM.
                    let candidateFreq = r.toFrequency(pitch.frequency);
                    let freqs = stmFreqs.concat(candidateFreq);
                    freqArrays.push(freqs);
                }
                candidates_pitches.push([pitch, candidateRatios, freqArrays])
            }

            // An array indexed by bestFitRelativeNote
            // containing an array of ratio candidates containing an array of frequencies to calculate dissonance.
            let freqMatrix = candidates_pitches.map(x => x[2]);

            let [p_idx, r_idx] = dissonanceMatrix(freqMatrix);
            bestFitRelativeFrom = candidates_pitches[p_idx][0];
            bestFitRatio = candidates_pitches[p_idx][1][r_idx];
            // console.log(`using dissonanceMatrix: ${(new Date()) - t} ms`);
            // console.log(`Choosing`, bestFitRelativeNote, bestFitRatio);

            newAbsRatio = bestFitRatio.add(bestFitRelativeFrom.absoluteRatio);
            existingPitch = this.getPitchByHarmCoords(newAbsRatio);

            let removeOffender = () => {
                // note: this wasm function will not consider the last element of the freq array
                //       to be the offender, since the last element is the most recent element.
                let idxOfHighestDissonance = findOffender(this.stmFrequencies);
                this.removePitchAtIdx(idxOfHighestDissonance);
            }

            if (existingPitch == null) {
                this.shortTermMemory.push(new Pitch(stepsFromA, bestFitRelativeFrom, bestFitRatio));
            } else {
                // If this note is existing already, refresh its countdown timer.
                existingPitch.noteOnTime = new Date();
            }

            // 4. If max short term memory or dissonance exceeded, remove the most obvious choice
            //    repeatedly until constraints are met.

            if (this.shortTermMemory.length > MAX_SHORT_TERM_MEMORY)
                removeOffender();

            while (true) {
                if (calculateDissonance(this.stmFrequencies) > this.effectiveMaxDiss)
                    removeOffender();
                else
                    break;
            }
        } else if (HARMONIC_CONTEXT_METHOD == 'l2' || HARMONIC_CONTEXT_METHOD == 'l2eo') {
            /**
             * A list of triples of (pitch, rel, abs)
             * where pitch: the relative pitch in short term memory this note is relative to
             * rel: the relative interval
             * abs: the aboslute interval from 1/1.
             *
             * @type {[Pitch, HarmonicCoordinates, HarmonicCoordinates][]}
             */
            let candidates = [];

            for (let pitch of this.shortTermMemory) {
                // relative candidate ratios to note in shortTermMem
                let candidateRel = convertStepsToPossibleCoord(stepsFromA - pitch.stepsFromA);
                let cds =
                    candidateRel
                        .map(x => [pitch, x, x.add(pitch.absoluteRatio)]);
                candidates = candidates.concat(cds);
            }

            let minDist = Infinity;
            /**
             * Stores the absolute harmonic coordinate of the best fit note.
             *
             * @type {HarmonicCoordinates}
             */
            newAbsRatio = null;
            let _pitch = null;
            let _rel = null;
            for (let [pitch, rel, abs] of candidates) {
                let dist;
                if (HARMONIC_CONTEXT_METHOD == 'l2eo')
                    dist = this.effectiveOrigin.harmonicDistance(abs);
                else if (HARMONIC_CONTEXT_METHOD == 'l2')
                    dist = this.#avgHc.harmonicDistance(abs);

                if (dist < minDist) {
                    minDist = dist;
                    newAbsRatio = abs;
                    _pitch = pitch;
                    _rel = rel;
                }
            }

            // console.log(
            //     `Choosing ${_rel.toRatioString()} of ${_pitch.stepsFromA}\\22 (${_pitch.absoluteRatio.toRatioString()}) = ${newAbsRatio.toRatioString()}`);

            existingPitch = this.getPitchByHarmCoords(newAbsRatio);

            if (existingPitch == null) {
                // prepare to add new pitch by assigning bestFitRelativeNote and bestFitRatio
                minDist = Infinity; // (not related to previous use)

                for (let pitch of this.shortTermMemory) {
                    let dist = pitch.absoluteRatio.harmonicDistance(newAbsRatio);
                    if (dist < minDist) {
                        minDist = dist;
                        bestFitRelativeFrom = pitch;
                    }
                }
                bestFitRatio = newAbsRatio.subtract(bestFitRelativeFrom.absoluteRatio);

                // so let's do it
                this.shortTermMemory.push(new Pitch(stepsFromA, bestFitRelativeFrom, bestFitRatio));
            } else {
                // If this note is existing already, refresh its countdown timer.
                existingPitch.noteOnTime = new Date();

                // console.log('reuse', existingPitch.absoluteRatio.toRatio());
            }

            // If max STM notes exceeded, remove the oldest note.
            if (this.shortTermMemory.length > MAX_SHORT_TERM_MEMORY) {
                this.removeOldest();
            }
        } else if (HARMONIC_CONTEXT_METHOD == '12ji') {
            if (coords == null) throw new Error('12ji harmonic context method requires coordinates to be explicitly stated.');
            newAbsRatio = new HarmonicCoordinates(coords);

            existingPitch = this.getPitchByHarmCoords(newAbsRatio);

            if (existingPitch == null) {
                // find the closest note in STM
                bestFitRelativeFrom = this.shortTermMemory[0];
                let closestDist = bestFitRelativeFrom.absoluteRatio.harmonicDistance(newAbsRatio);

                this.shortTermMemory.forEach((pitch, idx) => {
                    if (idx == 0) return;

                    let d = pitch.absoluteRatio.harmonicDistance(newAbsRatio);
                    if (d < closestDist) {
                        closestDist = d;
                        bestFitRelativeFrom = pitch;
                    }
                });

                bestFitRatio = newAbsRatio.subtract(bestFitRelativeFrom.absoluteRatio);

                this.shortTermMemory.push(new Pitch(stepsFromA, bestFitRelativeFrom, bestFitRatio));
            } else {
                existingPitch.noteOnTime = new Date();
            }

            if (this.shortTermMemory.length > MAX_SHORT_TERM_MEMORY) {
                this.removeOldest();
            }
        } else if (this.#graphHCM) {
            let candidateRootFreqs = this.shortTermMemory.map(x => x.absoluteRatio.toFrequency(this.absoluteOriginFreq));
            let removeOffender = (updateCandidateRoots) => {
                let idxOfOffender = findOffenderGraph(candidateRootFreqs, this.tonicityContext);
                if (HARMONIC_CONTEXT_METHOD == 'draw' && this.shortTermMemory[idxOfOffender].absoluteRatio.equals(this.#prevDrawTarget)) {
                    // If the offender is the previously drawn note, we should not remove it.
                    // Instead, remove the note with the lowest tonicity that isn't the drawn note.
                    let lowestTonicity = Infinity;
                    let idxDrawnNote = idxOfOffender;
                    idxOfOffender = -1;
                    this.tonicityContext.forEach((t, idx) => {
                        if (t < lowestTonicity && idx != idxDrawnNote) {
                            lowestTonicity = t;
                            idxOfOffender = idx;
                        }
                    });
                }
                if (idxOfOffender != -1) {
                    this.removePitchAtIdx(idxOfOffender);
                    if (updateCandidateRoots)
                        candidateRootFreqs.splice(idxOfOffender, 1);
                }
            }

            if (this.shortTermMemory.length >= MAX_SHORT_TERM_MEMORY) {
                removeOffender(true);
            }

            /** @type {[[HarmonicCoordinates]]} */
            let candidateHarmCoordsRelative = []; // these are relative to the candidate root note.
            let candidateRatios = []; // same as candidateHarmCoords but in multiplier form.

            this.shortTermMemory.forEach(pitch => {
                let ratios = convertStepsToPossibleCoord(stepsFromA - pitch.stepsFromA);
                candidateHarmCoordsRelative.push(ratios);
                if (HARMONIC_CONTEXT_METHOD === 'graph')
                    candidateRatios.push(ratios.map(r => r.toMultiplier()));
            })

            let rootIndex = -1; // index of this.shortTermMemory to use as parent pitch.
            let ratioIndex = -1;
            if (HARMONIC_CONTEXT_METHOD === 'graph') {
                let results = selectCandidate(candidateRootFreqs, this.tonicityContext, candidateRatios, NUM_ROOT_CANDIDATES);
                [rootIndex, ratioIndex] = results;
                bestFitRelativeFrom = this.shortTermMemory[rootIndex];
                bestFitRatio = candidateHarmCoordsRelative[rootIndex][ratioIndex];
                newAbsRatio = bestFitRatio.add(bestFitRelativeFrom.absoluteRatio);
            } else { // either 'graphdist' or 'draw'

                // Sort pitch indices by decreasing tonicity

                let pitchIndices = Array.from(this.shortTermMemory.keys());
                pitchIndices.sort((a, b) => this.tonicityContext[b] - this.tonicityContext[a]);

                if (HARMONIC_CONTEXT_METHOD == 'draw' && this.#currDrawTarget != null) {
                    // check if any of the candidates equal the draw target
                    for (let stmIdx of pitchIndices) {
                        let drawNoteFound = candidateHarmCoordsRelative[stmIdx].some((candidateRelativeToParent, j) => {
                            let absRatio = this.shortTermMemory[stmIdx].absoluteRatio.add(candidateRelativeToParent);
                            if (absRatio.equals(this.#currDrawTarget)) {
                                rootIndex = stmIdx;
                                ratioIndex = j;
                                return true; // this will break the lambda loop
                            }
                            return false;
                        });
                        if (drawNoteFound) {
                            drawNote = true;
                            bestFitRelativeFrom = this.shortTermMemory[rootIndex];
                            bestFitRatio = candidateHarmCoordsRelative[rootIndex][ratioIndex];
                            newAbsRatio = bestFitRatio.add(bestFitRelativeFrom.absoluteRatio);
                            break;
                        }
                    }

                    // If none of the candidates equal the draw target, check whether the draw
                    // target is octave equivalent to the current note being played. If so, we
                    // cheese the octave equivalence (and tempered commas, if any) and jump to the
                    // drawn note, where the drawn note has no parent.
                    if (!drawNote) {
                        // console.log('None of the candidates is the draw target.')
                        if (mod(stepsFromA - this.edosteps(this.#currDrawTarget), EDO) == 0) {
                            // console.log('Octave equivalent cheese found');
                            drawNote = true;
                            this.#newNoteBeforeTonicityComputation = true;
                            let cheesePitch = new Pitch(stepsFromA, null, this.#currDrawTarget, 0)
                            this.shortTermMemory.push(cheesePitch);
                            this.tonicityContext.push(0);
                            existingPitch = cheesePitch;
                            bestFitRelativeFrom = null;
                            bestFitRatio = this.#currDrawTarget;
                            newAbsRatio = this.#currDrawTarget;
                        }
                    }
                }

                if (HARMONIC_CONTEXT_METHOD == 'graphdist' || !drawNote) {
                    // 'graphdist' standard procedure happens method is graphdist, but also when the
                    // current note played is not a drawn note, and not temperable to any note that
                    // is octave equivalent to #currDrawTarget, then we will not have found any
                    // drawable candidate yet.

                    // limit top N tonicities only.
                    pitchIndices.splice(NUM_ROOT_CANDIDATES);

                    let minDist = Infinity;

                    for (let stmIdx of pitchIndices) {
                        candidateHarmCoordsRelative[stmIdx].forEach((candidateRelativeToParent, j) => {
                            let dist = candidateRelativeToParent.harmonicDistanceFromOrigin();
                            if (dist < minDist) {
                                minDist = dist;
                                rootIndex = stmIdx;
                                ratioIndex = j;
                            }
                        });
                    }
                    bestFitRelativeFrom = this.shortTermMemory[rootIndex];
                    bestFitRatio = candidateHarmCoordsRelative[rootIndex][ratioIndex];
                    newAbsRatio = bestFitRatio.add(bestFitRelativeFrom.absoluteRatio);
                }

                if (newAbsRatio == null) {
                    console.error('newAbsRatio is null!');
                    console.trace();
                }
            }
            existingPitch = existingPitch || this.getPitchByHarmCoords(newAbsRatio);

            if (existingPitch == null) {
                // Compare tonicities of the existing pitch vs the new octave-equivalent note.
                //
                // If the old one has higher tonicity, don't add the new note to the short term
                // memory, instead, return an octave offset version of the old note. Otherwise, if
                // the new one has higher tonicity, add the new note to the short term memory, and
                // remove the old octave note from the short term memory.

                // we only expect at most one other octave equivalent note at a time

                let octaveEquivIdx = -1;

                for (let idx of this.shortTermMemory.keys()) {
                    if (mod(this.shortTermMemory[idx].stepsFromA - stepsFromA, EDO) === 0) {
                        octaveEquivIdx = idx;
                        break;
                    }
                }

                if (octaveEquivIdx != -1) {
                    let replacedOctFreqs = candidateRootFreqs.slice();
                    replacedOctFreqs[octaveEquivIdx] = newAbsRatio.toFrequency(this.absoluteOriginFreq);
                    let oldTon = quickGraphDiss(candidateRootFreqs, this.tonicityContext).at(octaveEquivIdx);
                    let newTon = quickGraphDiss(replacedOctFreqs, this.tonicityContext).at(octaveEquivIdx);

                    if (newTon >= oldTon) {
                        // The new note overrides the previous octave equivalent note, initialized
                        // with the same tonicity at first.
                        this.shortTermMemory[octaveEquivIdx] =
                            new Pitch(stepsFromA, bestFitRelativeFrom, bestFitRatio, this.tonicityContext[octaveEquivIdx]);
                    } else {
                        // The new note is forced to be an exact octave multiple of the previous
                        // equivalent note.

                        let octaveIntervals = Math.floor((stepsFromA - this.shortTermMemory[octaveEquivIdx].stepsFromA) / EDO);
                        bestFitRelativeFrom = this.shortTermMemory[octaveEquivIdx];
                        bestFitRatio = new HarmonicCoordinates([octaveIntervals], octaveIntervals);
                        newAbsRatio = bestFitRatio.add(bestFitRelativeFrom.absoluteRatio);
                        existingPitch = this.getPitchByHarmCoords(newAbsRatio);
                        // there almost always should not be an existing pitch here. the only time
                        // this is possible is when two different edosteps somewhow detemper to the
                        // same note.
                    }
                } else {
                    // We have a completely new note, with no octave equivalence in the short term memory.
                    this.#newNoteBeforeTonicityComputation = true;

                    /*
                    Doing this may give too much importance to new notes.

                    // set tonicity of the new note to be 1/N (default uncomputed), and scale the
                    // tonicities of all the previous notes equally.
                    let newTonicity = 1 / (this.shortTermMemory.length);
                    this.tonicityContext.forEach((x, idx) => {
                        this.tonicityContext[idx] = x * (1 - newTonicity);
                        this.shortTermMemory[idx].tonicity = this.tonicityContext[idx];
                    })
                     */
                    let newTonicity = 0; // Completely new notes start with 0 tonicity.

                    this.shortTermMemory.push(new Pitch(stepsFromA, bestFitRelativeFrom, bestFitRatio, newTonicity));
                    this.tonicityContext.push(newTonicity);
                }
            }
            if (existingPitch != null) {
                // If this note is existing already, refresh its countdown timer.
                existingPitch.noteOnTime = new Date();
            }
        }


        // 3. If the new pitch clashes with any pitch by 1 edostep, remove the old pitch from STM.
        // Don't use this for 12ji mode or 12 edo (allow semitone clashes)
        if (HARMONIC_CONTEXT_METHOD != '12ji' && EDO != 12) {
            for (let i = 0; i < this.shortTermMemory.length - 1; i++) {
                if (Math.abs(this.shortTermMemory[i].stepsFromA - stepsFromA) === 1) {
                    this.removePitchAtIdx(i);
                    i--;
                }
            }
        }

        // Remove older notes which are too far out harmonically from this new note.

        let highestHarmonicDistance = 0;
        let sumHarmonicDistance = 0;
        for (let i = 0; i < this.shortTermMemory.length - 1; i++) {
            let p = this.shortTermMemory[i];
            let harmonicDistance = newAbsRatio.harmonicDistance(p.absoluteRatio);
            if (harmonicDistance > highestHarmonicDistance)
                highestHarmonicDistance = harmonicDistance;
            sumHarmonicDistance += harmonicDistance;
            if (harmonicDistance > MAX_HARMONIC_DISTANCE) {
                this.removePitchAtIdx(i);
                i--;
                continue;
            }

            // 6. At the same time, update the strike counter and remove accordingly.
            if (!newPitchIsOctaveOfExistingPitches) {
                p.strikeCounter++;

                if (p.strikeCounter > MAX_NEW_NOTES_BEFORE_FORGET) {
                    this.removePitchAtIdx(i);
                    i--;
                }
            }
        }

        this.#maxHarmDist = highestHarmonicDistance;
        if (this.shortTermMemory.length === 0)
            this.#meanHarmDist = 0;
        else
            this.#meanHarmDist = sumHarmonicDistance / this.shortTermMemory.length;

        // console.log(`Using findOffender: ${(new Date()) - t} ms`);

        this.updateStatistics();

        if (drawNote) {
            this.nextDrawTarget();
        }

        if (existingPitch)
            return [existingPitch.parent, existingPitch.relativeRatio, drawNote];
        else
            return [bestFitRelativeFrom, bestFitRatio, drawNote];
    }

    /**
     * Only put things that don't require constant updating inside this function.
     * this function is called after noteOn event, {@linkcode registerNote}, is received.
     */
    updateStatistics() {
        let sumHc = new HarmonicCoordinates([0]);

        // The fifths are in a circle. That means the arithmetic mean can't be used
        // to calculate the mean fifth as how the average of 30 degrees and 330 degrees
        // is NOT 180 degrees, but 0 degrees.
        // To do this, convert the value of the fifths into an angle spanning 0 to 2pi radians,
        // convert the angle into arbitrary cartesian coordinates along a unit circle,
        // then find the centroid of the coordinates,
        // then convert the coordinates back into an angle using atan2.
        // https://en.wikipedia.org/wiki/Circular_mean
        let avgFifthX = 0;
        let avgFifthY = 0;

        let lowestp2abs = null;
        let lowestp3 = null;

        if (this.shortTermMemory.length !== 0) {
            for (let pitch of this.shortTermMemory) {
                sumHc = sumHc.add(pitch.absoluteRatio);

                let fifths = EDOSTEPS_TO_FIFTHS_MAP[mod(pitch.stepsFromA, EDO)];
                let radians = fifths / EDO * Math.PI * 2;
                avgFifthX += Math.cos(radians);
                avgFifthY += Math.sin(radians);

                if (lowestp2abs === null || pitch.absoluteRatio.p2absolute < lowestp2abs)
                    lowestp2abs = pitch.absoluteRatio.p2absolute;
                if (lowestp3 === null || pitch.absoluteRatio.p3 < lowestp3)
                    lowestp3 = pitch.absoluteRatio.p3;
            }

            avgFifthX /= this.shortTermMemory.length;
            avgFifthY /= this.shortTermMemory.length;
        }

        if (avgFifthX !== 0 || avgFifthY !== 0) {
            let centralFifthRadians = Math.atan2(avgFifthY, avgFifthX);
            // mod is necessary as central fifth radians returns negative for angles above 180.
            this.#centralFifth = mod(Math.round(EDO * centralFifthRadians / (2 * Math.PI)), EDO);
        }

        this.#avgHc = new HarmonicCoordinates(sumHc.coords.map(x => x / this.shortTermMemory.length));

        let now = new Date();
        if (!this.#graphHCM && this.shortTermMemory.length > 1) {
            // The following dissonance & key heuristics are only applicable for non-graph methods.

            this.#dissonance = calculateDissonance(this.stmFrequencies);

            let consThresh = CONSONANCE_THRESH_N_NOTES[this.shortTermMemory.length] ?? CONSONANCE_THRESHOLD;

            // 'change key', heuristic tonal center. Not applicable for graph harmonic context method.
            if (this.dissonance < consThresh && now - this.#lastKeyChangeTime > FASTEST_KEY_CHANGE_SECS) {
                this.#lastKeyChangeTime = now;

                let hc = this.#avgHc.round();

                let p2 = hc.p2;
                let p3 = hc.p3;

                if (hc.p2absolute - lowestp2abs > HIGHEST_REL_P2_DENOM)
                    // reduce p2 such that hc.p2absolute - lowestp2abs === HIGHEST_REL_P2_DENOM
                    p2 -= hc.p2absolute - lowestp2abs - HIGHEST_REL_P2_DENOM;
                if (hc.p3 - lowestp3 > HIGHEST_REL_P3_DENOM)
                    p3 -= hc.p3 - lowestp3 - HIGHEST_REL_P3_DENOM;

                hc = new HarmonicCoordinates([p2, p3, ...hc.coords.slice(2)]);

                this.#effectiveOrigin = hc;

                // After effective origin is changed, we have to find the nearest note to the
                // effectiveOrigin to use as the reference point for note naming.

                let minDist = Infinity;
                let nearestPitch = null;
                for (let pitch of this.shortTermMemory) {
                    let dist = this.#effectiveOrigin.harmonicDistance(pitch.absoluteRatio);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestPitch = pitch;
                    }
                }
                this.pitchNearestToOrigin = nearestPitch;

                // now we find the NoteName of the effective origin, relative to the pitchNearestToOrigin.

                let nearestPitchNoteName = getDefaultNoteName(nearestPitch.stepsFromA);
                this.#effectiveOriginNoteName = nearestPitchNoteName.add(this.effectiveOrigin.subtract(nearestPitch.absoluteRatio));
            }
        }
    }

    /**
     * Retrieve the note name of the note at the given absolute harmonic coordinates, relative to
     * the current effective origin.
     *
     * This note name removes comma pumps resulting from the detemperament, but still retains the
     * relative ratios of all notes and spells the notes correctly and one-to-one according to the
     * JI interpretation.
     *
     * @param {HarmonicCoordinates} absCoords The absolute harmonic coordinates from 1/1.
     * @returns {NoteName} The {@linkcode NoteName} of the note at the given absolute harmonic coordinates.
     */
    getNoteName(absCoords) {
        return this.effectiveOriginNoteName.add(
            absCoords.subtract(this.effectiveOrigin)
        );
    }

    /**
     * Returns true if the harmonic context contains some tempered note.
     *
     * @param {number} stepsFromA
     * @returns
     */
    containsNote(stepsFromA) {
        return this.shortTermMemory.some(x => x.stepsFromA === stepsFromA);
    }

    /**
     * Returns true if the pitch memory contains (tempered) octaves of the note.
     *
     * @param {number} stepsFromA
     */
    containsOctavesOfNote(stepsFromA) {
        let octRed = mod(stepsFromA, EDO);
        return this.shortTermMemory.some(x => mod(x.stepsFromA, EDO) === octRed);
    }

    /**
     * Returns the list of indices that are equal or octave equivalent to the given note.
     *
     * @param {number} stepsFromA
     */
    octaveEquivIndices(stepsFromA) {
        let octIndices = [];
        let modSteps = mod(stepsFromA, EDO);

        for (const idx of this.shortTermMemory.keys()) {
            if (mod(this.shortTermMemory[idx].stepsFromA, EDO) === modSteps) {
                octIndices.push(idx);
            }
        }
        return octIndices;
    }

    /**
     * Returns true if the pitch memory contains an exact absolute coordinate
     *
     * @param {HarmonicCoordinates} absCoords
     */
    containsHarmCoords(harmCoords) {
        return this.shortTermMemory.some(x => x.absoluteRatio.equals(harmCoords));
    }

    /**
     * @param {HarmonicCoordinates} harmCoords
     * @returns {Pitch|null}
     */
    getPitchByHarmCoords(harmCoords) {
        for (let pitch of this.shortTermMemory) {
            if (pitch.absoluteRatio.equals(harmCoords))
                return pitch;
        }
        return null;
    }

    relativeToEffectiveOrigin(absoluteCoords) {
        return absoluteCoords.subtract(this.#effectiveOrigin);
    }

    /**
     * veh nai.
     *
     * For each {@linkcode Pitch} in {@linkcode shortTermMemory}, displays, in order:
     *
     * * Comma de-pumped note name
     * * edosteps from A4
     * * tonicity (if not null)
     * * absolute harmonic coordinates/monzo
     *
     * @returns a very cool display string
     */
    toVeryNiceDisplayString() {
        // NOTE: \xa0 is a non-breaking space.
        let stm = this.shortTermMemory;
        if (HARMONIC_CONTEXT_METHOD == 'graph' || HARMONIC_CONTEXT_METHOD == 'graphdist') {
            stm = stm.toSorted((a, b) => b.tonicity - a.tonicity)
        }
        let str = stm
            .map(x =>
                this.getNoteName(x.absoluteRatio).toString().padEnd(9, '\xa0') + ' '
                + x.stepsFromA.toString().padStart(4, '\xa0') + ' '
                + (x.tonicity != null ? x.tonicity.toFixed(3) + ' ' : '')
                + x.absoluteRatio.toMonzoString())
            .join('\n');

        if (HARMONIC_CONTEXT_METHOD == 'draw') {
            if (this.#currDrawTarget != null) {
                let target = this.#currDrawTarget;
                let temperedNoteName = getDefaultNoteName(this.edosteps(target));
                let untemperedNoteName = this.getNoteName(target);
                let prefix = `${this.#drawIdx}/${DRAW_COORDS.length}: (${temperedNoteName}) ${untemperedNoteName} ${target.toMonzoString()}\n\n`;
                str = prefix + str;
            } else {
                str = 'お誕生日おめでとう!\n\n' + str;
            }
        }

        return str;
    }

    /**
     * Get the number of edosteps from A4 of `coord`.
     *
     * This calcualtion is relative to {@linkcode pitchNearestToOrigin}'s
     * {@linkcode Pitch.stepsFromA} and `coord` is tempered relative to
     * {@linkcode pitchNearestToOrigin}.
     *
     * @param {HarmonicCoordinates | NoteName} coord
     * @returns {number} The absolute number of edosteps from A4.
     */
    edosteps(coord) {
        if (this.pitchNearestToOrigin == null) {
            return coord.edosteps;
        }
        return this.pitchNearestToOrigin.stepsFromA + coord.subtract(this.pitchNearestToOrigin.absoluteRatio).edosteps;
    }

    // in the event the HarmonicCoordinates get out of hand or something...
    // only makes sense to call this once the screen is entirely empty and
    // there are no balls or scaffolding rendered.
    reset() {
        this.shortTermMemory = [];
        this.tonicityContext = [];
        this.#avgHc = new HarmonicCoordinates([0]);
        this.#tonalCenterUnscaledCoords = [0, 0, 0];
        this.#dissonance = 0;
        // this.#centralFifth = 0; don't reset fifths since it's probable the key will stay the same.
        this.#effectiveOrigin = new HarmonicCoordinates([0]);
        this.#meanHarmDist = 0;
        this.#maxHarmDist = 0;
    }
}
