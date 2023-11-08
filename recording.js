/**
 * Data for each recorded note.
 */
export class RecNote {
    /** 
    * The time (in ms) that this note occurs relative to the when the first note of the recording is.
    * 
    * @type {number}
    */
    timeOn;
    /**
     * Number of edosteps from A4
     * 
     * @type {number}
     */
    stepsFromA;
    /**
     * Harmonic coordinate of this note.
     */
    harmCoords;

    constructor(timeOn, stepsFromA, harmCoords) {
        this.timeOn = timeOn;
        this.stepsFromA = stepsFromA;
        this.harmCoords = harmCoords;
    }
}

/**
 * Recorded notes for making the lattice sculpture.
 * (Run one recording pass in normal mode then set `SCULPTURE_MODE` in configs.js to `true`)
 * 
 * @type {RecNote[]}
 */
export let RECORDED_NOTES = [];

export let IS_RECORDING = false;

/**
 * Starts recording. (The recording only starts when the first note after beginRecording is played.)
 * 
 * NOTE: the recording is done in note-tracking.js
 */
window.beginRecording = function() {
    IS_RECORDING = true;
    RECORDED_NOTES = [];
}

/**
 * Finishes recording and dumps the recorded JSON data to the console.
 */
window.endRecording = function() {
    IS_RECORDING = false;
    console.log(JSON.stringify(RECORDED_NOTES));
    window.recordedNotes = RECORDED_NOTES;
}
