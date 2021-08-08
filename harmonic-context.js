class Pitch {
    /**
     * @type {number}
     */
    stepsFromA;
    /**
     * @type {HarmonicCoordinates}
     */
    functioningAs;
    /**
     * @type {number}
     */
    frequency;
    /**
     *  @type {Pitch}
     */
    origin;
    /**
     * @type {HarmonicCoordinates}
     */
    relativeRatio;

    constructor(stepsFromA, origin, relativeRatio) {
        this.stepsFromA = stepsFromA;
        this.frequency = 440 * 2 ** (stepsFromA / 31);
        this.origin = origin;
        this.relativeRatio = relativeRatio;
        if (origin)
            this.absoluteRatio = this.origin.absoluteRatio.add(this.relativeRatio);
        else {
            this.absoluteRatio = this.relativeRatio;
            origin = null;
        }
    }
}

// The harmonic context represents the 'tonal center'
// for which all new notes will be judged with respect to,
// and each addition of a new note will
class HarmonicContext {
    // modelling the harmonic tonal space of the brain in short term memory
    #tonalCenterUnscaledCoords = [0, 0];
    #dCenter_dRotator = [0, 0];
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
     * Repeated comma shifts can cause the lattice to appear extremely haywire
     * @type {HarmonicCoordinates}
     */
    #effectiveOrigin = new HarmonicCoordinates(0,0,0,0,0);

    constructor() {

    }

    get dissonance() {
        return this.#dissonance;
    }

    get effectiveMaxDiss() {
        return this.#effectiveMaxDiss;
    }

    get fatigue() {
        return this.#fatigue;
    }

    get maxHarmonicDistance() {
        return this.#maxHarmDist;
    }

    get meanHarmonicDistance() {
        return this.#meanHarmDist;
    }


    get tonalCenterUnscaledCoords() {
        return this.#tonalCenterUnscaledCoords;
    }

    get dCenterCoords_dRotator() {
        return this.#dCenter_dRotator;
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


        let avg2, avg3, avg5, avg7, avg11;
        avg2 = avg3 = avg5 = avg7 = avg11 = 0;

        if (this.shortTermMemory.length !== 0) {
            for (let pitch of this.shortTermMemory) {
                avg2 += pitch.absoluteRatio.p2;
                avg3 += pitch.absoluteRatio.p3;
                avg5 += pitch.absoluteRatio.p5;
                avg7 += pitch.absoluteRatio.p7;
                avg11 += pitch.absoluteRatio.p11;
            }

            avg2 /= this.shortTermMemory.length;
            avg3 /= this.shortTermMemory.length;
            avg5 /= this.shortTermMemory.length;
            avg7 /= this.shortTermMemory.length;
            avg11 /= this.shortTermMemory.length;
        }

        let avgHC = new HarmonicCoordinates(avg2, avg3, avg5, avg7, avg11);
        this.#tonalCenterUnscaledCoords = avgHC.toUnscaledCoords();
        this.#dCenter_dRotator = avgHC.dUnscaledCoords_dRotation;
    }
    /**
     * Register a new note from noteOn event.
     *
     * @param stepsFromA
     * @returns {[?Pitch, HarmonicCoordinates]} a tuple pair containing the pitch referenced in short term memory
     *                                          and the relative interval between the reference pitch and the new pitch.
     *                                          If the HarmonicContext is completely empty, the first item will be null.
     */
    registerNote(stepsFromA) {
        if (this.shortTermMemory.length === 0) {
            // 1. SIMPLE.
            let harmonicCoordinates = new HarmonicCoordinates(0, 0, 0, 0, 0);
            this.shortTermMemory.push(new Pitch(stepsFromA, null, harmonicCoordinates));
            return [null, harmonicCoordinates];
        }

        // 2. else find candidate possible correlation by brute forcing all the different ways
        // the new note can relate to the existing notes in the short term memory.

        // note that the existing notes in the short term memory will all be set to
        // fixed tempered 31 edo pitches, but the note in question will be tested in just intonation
        // with respect to each of the existing 31 edo pitches to solve the ambiguity of the harmonic function
        // of the newly added note.

        let stmFreqs = this.stmFrequencies();

        /**
         * @type {Pitch}
         */
        let bestFitRelativeNote; // The preferred note that the ratio is relative to
        /**
         * @type {HarmonicCoordinates}
         */
        let bestFitRatio; // the preferred perceived ratio between the relative note and the new registered note.

        // let t = new Date();

        // this structure is used to map the wasm result back into
        // js objects.
        let candidates_pitches = [];

        for (let pitch of this.shortTermMemory) {
            let candidateRatios = convertStepsToPossibleCoord(stepsFromA - pitch.stepsFromA);
            let freqArrays = [];
            for (let r of candidateRatios) {
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
        bestFitRelativeNote = candidates_pitches[p_idx][0];
        bestFitRatio = candidates_pitches[p_idx][1][r_idx];
        // console.log(`using dissonanceMatrix: ${(new Date()) - t} ms`);
        // console.log(`Choosing`, bestFitRelativeNote, bestFitRatio);

        let newAbsRatio = bestFitRatio.add(bestFitRelativeNote.absoluteRatio);

        let existingPitch = this.getPitchByHarmCoords(newAbsRatio);

        let removeOffender = () => {
            // note: this wasm function will not consider the last element of the freq array
            //       to be the offender, since the last element is the most recent element.
            let idxOfHighestDissonance = findOffender(this.stmFrequencies());
            this.shortTermMemory.splice(idxOfHighestDissonance, 1);
        }

        if (!existingPitch)
            this.shortTermMemory.push(new Pitch(stepsFromA, bestFitRelativeNote, bestFitRatio));

        // 3. If the new pitch clashes with any pitch by 1 diesis, remove the old pitch from STM.

        for (let i = 0; i < this.shortTermMemory.length; i++) {
            if (Math.abs(this.shortTermMemory[i].stepsFromA - stepsFromA) === 1) {
                this.shortTermMemory.splice(i, 1);
                i --;
            }
        }

        // 4. If max short term memory or dissonance exceeded, remove the most obvious choice
        //    repeatedly until constraints are met.

        // t = new Date();

        if (this.shortTermMemory.length > MAX_SHORT_TERM_MEMORY)
            removeOffender();

        while (true) {
            if(calculateDissonance(this.stmFrequencies()) > this.effectiveMaxDiss)
                removeOffender();
            else
                break;
        }

        // 5. Remove older notes which are too far out harmonically from this new note.

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
            return [bestFitRelativeNote, bestFitRatio];
    }

    // Only put things that don't require constant updating inside this function.
    // this function is called after a noteOn event is received.
    updateStatistics() {
        this.#dissonance = calculateDissonance(this.stmFrequencies());
    }

    stmFrequencies() {
        return this.shortTermMemory.map(x => x.frequency);
    }

    containsNote(stepsFromA) {
        return this.shortTermMemory.some(x => x.stepsFromA === stepsFromA);
    }

    containsHarmCoords(harmCoords) {
        return this.shortTermMemory.some(x => x.absoluteRatio.equals(harmCoords));
    }

    getPitchByHarmCoords(harmCoords) {
        return this.shortTermMemory.filter(x => x.absoluteRatio.equals(harmCoords))[0] || null;
    }

    // in the event the HarmonicCoordinates get out of hand or something...
    // only makes sense to call this once the screen is entirely empty and
    // there are no balls or scaffolding rendered.
    reset() {
        this.shortTermMemory = [];
        this.#tonalCenterUnscaledCoords = [0, 0];
        this.#dissonance = 0;
    }
}
