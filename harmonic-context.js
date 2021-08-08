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
            this.functioningAs = this.origin.functioningAs.add(this.relativeRatio);
        else {
            this.functioningAs = this.relativeRatio;
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
    shortTermMemory = [];

    constructor() {

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

        let newAbsRatio = bestFitRatio.add(bestFitRelativeNote.functioningAs);

        let existingPitch = this.getPitchByHarmCoords(newAbsRatio);
        console.log(existingPitch);
        if (existingPitch) {
            // There are no new interpretations of this note.
            // Don't change the harmonic context
            // re-submit the existing
            return [existingPitch.origin, existingPitch.relativeRatio];
        }

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

        let removeOffender = () => {
            // note: this wasm function will not consider the last element of the freq array
            //       to be the offender, since the last element is the most recent element.
            let idxOfHighestDissonance = findOffender(this.stmFrequencies());
            this.shortTermMemory.splice(idxOfHighestDissonance, 1);
        }

        if (this.shortTermMemory.length > MAX_SHORT_TERM_MEMORY)
            removeOffender();

        while (true) {
            if(calculateDissonance(this.stmFrequencies()) > MAX_DISSONANCE)
                removeOffender();
            else
                break;
        }

        // 5. Remove older notes which are too far out harmonically from this new note.

        for (let i = 0; i < this.shortTermMemory.length - 1; i++) {
            let p = this.shortTermMemory[i];
            if (newAbsRatio.harmonicDistance(p) > MAX_HARMONIC_DISTANCE) {
                this.shortTermMemory.splice(i, 1);
                i--;
            }
        }


        // console.log(`Using findOffender: ${(new Date()) - t} ms`);

        this.updateStatistics();

        return [bestFitRelativeNote, bestFitRatio];
    }

    get tonalCenterUnscaledCoords() {
        return this.#tonalCenterUnscaledCoords;
    }

    // These coordinates may be used to set the viewport's center to the
    // literal 'tonal center'. Not sure if this even results in anything
    // useful though...
    updateStatistics() {
        let avg2, avg3, avg5, avg7, avg11;
        avg2 = avg3 = avg5 = avg7 = avg11 = 0;

        for (let pitch of this.shortTermMemory) {
            avg2 += pitch.functioningAs.p2;
            avg3 += pitch.functioningAs.p3;
            avg5 += pitch.functioningAs.p5;
            avg7 += pitch.functioningAs.p7;
            avg11 += pitch.functioningAs.p11;
        }

        avg2 /= this.shortTermMemory.length;
        avg3 /= this.shortTermMemory.length;
        avg5 /= this.shortTermMemory.length;
        avg7 /= this.shortTermMemory.length;
        avg11 /= this.shortTermMemory.length;

        let avgHC = new HarmonicCoordinates(avg2, avg3, avg5, avg7, avg11);

        this.#tonalCenterUnscaledCoords = avgHC.toUnscaledCoords();
    }

    stmFrequencies() {
        return this.shortTermMemory.map(x => x.frequency);
    }

    containsNote(stepsFromA) {
        return this.shortTermMemory.some(x => x.stepsFromA === stepsFromA);
    }

    containsHarmCoords(harmCoords) {
        return this.shortTermMemory.some(x => x.functioningAs.equals(harmCoords));
    }

    getPitchByHarmCoords(harmCoords) {
        return this.shortTermMemory.filter(x => x.functioningAs.equals(harmCoords))[0] || null;
    }

    // in the event the HarmonicCoordinates get out of hand or something...
    // only makes sense to call this once the screen is entirely empty and
    // there are no balls or scaffolding rendered.
    reset() {
        this.shortTermMemory = [];
        this.#tonalCenterUnscaledCoords = [0, 0];
    }
}
