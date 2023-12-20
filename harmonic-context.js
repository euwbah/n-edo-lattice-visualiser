import { CONSONANCE_THRESHOLD, EDO, FASTEST_KEY_CHANGE_SECS, HARMONIC_CONTEXT_METHOD, HIGHEST_REL_P2_DENOM, HIGHEST_REL_P3_DENOM, MAX_DISSONANCE, MAX_DURATION_BEFORE_FORGET_SECS, MAX_DURATION_BEFORE_FORGET_SECS_SUSTAINED, MAX_FATIGUE_SECS, MAX_HARMONIC_DISTANCE, MAX_NEW_NOTES_BEFORE_FORGET, MAX_SHORT_TERM_MEMORY } from "./configs.js";
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
    origin;
    /**
     * Harmonic coordinates relative to {@linkcode origin}
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
     */
    noteOnTime;

    constructor(stepsFromA, origin, relativeRatio) {
        this.stepsFromA = stepsFromA;
        this.frequency = 440 * 2 ** (stepsFromA / EDO);
        this.origin = origin;
        this.relativeRatio = relativeRatio;
        this.noteOnTime = new Date();
        if (origin)
            this.absoluteRatio = this.origin.absoluteRatio.add(this.relativeRatio);
        else {
            this.absoluteRatio = this.relativeRatio;
            this.origin = null;
        }
    }
}

// The harmonic context represents the 'tonal center'
// for which all new notes will be judged with respect to,
// and each addition of a new note will cause the harmonic centroid
// (i.e. the 'key center') to update.
export class HarmonicContext {
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
     * @type {[Pitch]}
     */
    shortTermMemory = [];
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
     * stores the last time the effective origin was changed so that
     * a new effective origin will not change so rapidly.
     * @type {Date}
     */
    #lastKeyChangeTime = new Date();

    /**
     * The mean fifth value (0 is A) of the notes in the shortTermMemory, rounded to the nearest whole.
     * @type {number}
     */
    #centralFifth = 0;

    constructor() {

    }

    /**
     * Dissonance score as per WASM dissonance calculations, evaluated every time {@linkcode updateStatistics} is called.
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
     * A false origin chosen such that the ratios (w.r.t. effectiveOrigin) of the notes on screen
     * is as simple as possible (minimal monzo numbers). Also used to calculate harmonic distance for
     * {@linkcode HARMONIC_CONTEXT_METHOD} `l2eo` mode.
     *
     * NOTE: The 3D centroid (this.#tonalCenterUnscaledCoords) of the Harmonic Context structure
     * is not determined with this method, instead it is determined using the standard centroid
     * algorithm: the mean of each axis of each pitch in the harmonic context.
     *
     * The difference between this `effectiveOrigin` and the centroid HarmonicCoordinates is that
     * the effectiveOrigin has it's harmonic coordinates rounded to the nearest whole number.
     * @type {HarmonicCoordinates}
     */
    get effectiveOrigin() {
        return this.#effectiveOrigin;
    }

    get centralFifth() {
        return this.#centralFifth;
    }

    tick() {
        if (this.dissonance > CONSONANCE_THRESHOLD) {
            let df = deltaTime / 1000 / MAX_FATIGUE_SECS * (this.dissonance - CONSONANCE_THRESHOLD) / (MAX_DISSONANCE - CONSONANCE_THRESHOLD);
            this.#fatigue = Math.min(1, this.fatigue + df);
        } else {
            // Fatigue recovers at least twice as fast.
            let df = deltaTime / 1000 / MAX_FATIGUE_SECS;
            this.#fatigue = Math.max(0, this.fatigue - df * 2);
        }
        this.#effectiveMaxDiss = CONSONANCE_THRESHOLD + (MAX_DISSONANCE - CONSONANCE_THRESHOLD) * (1 - this.fatigue);

        this.#tonalCenterUnscaledCoords = this.#avgHc.toUnscaledCoords();

        let now = new Date();

        // forget notes that are very old.

        for (let i = 0; i < this.shortTermMemory.length; i++) {
            let p = this.shortTermMemory[i];
            let keystate = KEYS_STATE[p.stepsFromA]; // use this to determine whether/when forgetting should occur.
            if ((!keystate
                    && now - p.noteOnTime > MAX_DURATION_BEFORE_FORGET_SECS * 1000)
                || (keystate && keystate.fromSustainPedal
                    && now - p.noteOnTime > MAX_DURATION_BEFORE_FORGET_SECS_SUSTAINED * 1000)) {
                this.shortTermMemory.splice(i, 1);
                i --;
            }
        }
    }

    /**
     * Removes the oldest note from {@linkcode shortTermMemory} (in terms of {@linkcode Pitch.noteOnTime})
     */
    removeOldest() {
        let oldestIdx = -1;
        for (let i = 0; i < this.shortTermMemory.length; i++) {
            if (oldestIdx == -1) {
                oldestIdx = i;
                continue;
            }

            if (this.shortTermMemory[i].noteOnTime < this.shortTermMemory[oldestIdx].noteOnTime) {
                oldestIdx = i;
            }
        }

        if (oldestIdx != -1) {
            this.shortTermMemory.splice(oldestIdx, 1);
        }
    }

    /**
     * Register a new note from noteOn event, performing detempering calculations.
     *
     * @param stepsFromA The edosteps from A of the note to add. If `12ji` mode, this should be used to distinguish
     * between distinct MIDI notes.
     *
     * @param coords {number[]?} absolute harmonic coordinate vector (Monzo) of this note to add, specify if and only if
     * {@linkcode HARMONIC_CONTEXT_METHOD} is `12ji`.
     *
     * @returns {[?Pitch, HarmonicCoordinates]} a tuple pair containing the pitch referenced in short term memory
     * and the relative interval between the reference pitch and the new pitch. If the HarmonicContext is completely
     * empty, the first item will be null, and the 'relative interval' is absolute with respect to the origin.
     */
    registerNote(stepsFromA, coords = null) {
        if (this.shortTermMemory.length === 0) {
            // 1. SIMPLE.
            let harmonicCoordinates = new HarmonicCoordinates(coords ?? [0]);
            this.shortTermMemory.push(new Pitch(stepsFromA, null, harmonicCoordinates));
            return [null, harmonicCoordinates];
        }

        // 2. else find candidate possible correlation by brute forcing all the different ways
        // the new note can relate to the existing notes in the short term memory.

        // note that the existing notes in the short term memory will all be set to
        // fixed tempered, quantized N edo pitches, but the note in question will be tested in just intonation
        // with respect to each of the existing quantized pitches to solve the ambiguity of the harmonic function
        // of the newly added note.

        let stmFreqs = this.stmFrequencies;

        /**
         * The preferred note that the ratio is relative to/constructed from.
         * @type {Pitch}
         */
        let bestFitRelativeFrom;
        /**
         * the preferred perceived relative ratio between the `bestFitRelativeNote` and the new registered note.
         * @type {HarmonicCoordinates}
         */
        let bestFitRatio;

        /**
         * The `bestFitRatio` with absolute coordinates relative to origin.
         * @type {HarmonicCoordinates}
         */
        let newAbsRatio;

        /**
         * true if the new pitch is an octave of an existing pitch.
         * @type {boolean}
         */
        let newPitchIsOctaveOfExistingPitches = this.containsOctavesOfNote(stepsFromA);

        /**
         * if newAbsRatio is equal to some existing pitch in the short term memory,
         * this will be a reference to that pitch.
         * @type {Pitch}
         */
        let existingPitch;

        if (HARMONIC_CONTEXT_METHOD == 'cb') {
            // let t = new Date();

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
                this.shortTermMemory.splice(idxOfHighestDissonance, 1);
            }

            if (existingPitch == null) {
                this.shortTermMemory.push(new Pitch(stepsFromA, bestFitRelativeFrom, bestFitRatio));
            } else {
                // If this note is existing already, refresh its countdown timer.
                existingPitch.noteOnTime = new Date();
            }

            // 4. If max short term memory or dissonance exceeded, remove the most obvious choice
            //    repeatedly until constraints are met.

            // t = new Date();

            if (this.shortTermMemory.length > MAX_SHORT_TERM_MEMORY)
                removeOffender();

            while (true) {
                if(calculateDissonance(this.stmFrequencies) > this.effectiveMaxDiss)
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
            for(let [pitch, rel, abs] of candidates) {
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
        }


        // 3. If the new pitch clashes with any pitch by 1 edostep, remove the old pitch from STM.
        // Don't use this for 12ji mode.
        if (HARMONIC_CONTEXT_METHOD != '12ji') {
            for (let i = 0; i < this.shortTermMemory.length - 1; i++) {
                if (Math.abs(this.shortTermMemory[i].stepsFromA - stepsFromA) === 1) {
                    this.shortTermMemory.splice(i, 1);
                    i --;
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
                this.shortTermMemory.splice(i, 1);
                i--;
                continue;
            }

            // 6. At the same time, update the strike counter and remove accordingly.
            if (!newPitchIsOctaveOfExistingPitches) {
                p.strikeCounter ++;

                if (p.strikeCounter > MAX_NEW_NOTES_BEFORE_FORGET) {
                    this.shortTermMemory.splice(i, 1);
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

        if (existingPitch)
            return [existingPitch.origin, existingPitch.relativeRatio];
        else
            return [bestFitRelativeFrom, bestFitRatio];
    }

    /**
     * Only put things that don't require constant updating inside this function.
     * this function is called after noteOn event, {@linkcode registerNote}, is received.
     */
    updateStatistics() {
        this.#dissonance = calculateDissonance(this.stmFrequencies);

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

        this.#avgHc = new HarmonicCoordinates(sumHc.coords.map(x => x / this.shortTermMemory.length));

        let now = new Date();
        // 'change key'
        if (this.dissonance < CONSONANCE_THRESHOLD && now - this.#lastKeyChangeTime > FASTEST_KEY_CHANGE_SECS) {
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
        }

        // In the very impossible case that the notes in the harmonic context are
        // perfectly evenly distributed around the circle of fifths, don't update the central fifth.

        // if (avgFifthX === 0 && avgFifthY === 0) {
        //     // this.#centralFifth = 0;
        // }

        if (avgFifthX !== 0 || avgFifthY !== 0) {
            let centralFifthRadians = Math.atan2(avgFifthY, avgFifthX);
            // mod is necessary as central fifth radians returns negative for angles above 180.
            this.#centralFifth = mod(Math.round(EDO * centralFifthRadians / (2 * Math.PI)), EDO);
        }
    }

    containsNote(stepsFromA) {
        return this.shortTermMemory.some(x => x.stepsFromA === stepsFromA);
    }

    containsOctavesOfNote(stepsFromA) {
        let octRed = mod(stepsFromA, EDO);
        return this.shortTermMemory.some(x => mod(x.stepsFromA, EDO) === octRed);
    }

    containsHarmCoords(harmCoords) {
        return this.shortTermMemory.some(x => x.absoluteRatio.equals(harmCoords));
    }

    /**
     * @param {HarmonicCoordinates} harmCoords
     * @returns {Pitch|null}
     */
    getPitchByHarmCoords(harmCoords) {
        return this.shortTermMemory.filter(x => x.absoluteRatio.equals(harmCoords))[0] || null;
    }

    relativeToEffectiveOrigin(absoluteCoords) {
        return absoluteCoords.subtract(this.#effectiveOrigin);
    }

    /**
     * veh nai.
     *
     * @returns a very cool display string
     */
    toVeryNiceDisplayString() {
        return this.shortTermMemory
            .map(x => x.stepsFromA.toString().padStart(4, '\xa0') + ' ' + x.absoluteRatio.toMonzoString())
            .reverse()
            .join('\n');
    }

    // in the event the HarmonicCoordinates get out of hand or something...
    // only makes sense to call this once the screen is entirely empty and
    // there are no balls or scaffolding rendered.
    reset() {
        this.shortTermMemory = [];
        this.#avgHc = new HarmonicCoordinates([0]);
        this.#tonalCenterUnscaledCoords = [0, 0, 0];
        this.#dissonance = 0;
        // this.#centralFifth = 0; don't reset fifths since it's probable the key will stay the same.
        this.#effectiveOrigin = new HarmonicCoordinates([0]);
        this.#meanHarmDist = 0;
        this.#maxHarmDist = 0;
    }
}
