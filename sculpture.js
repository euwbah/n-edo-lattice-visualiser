import { EDO, MAX_FIFTH_HUE, MIN_FIFTH_HUE, SCULPTURE_BALL_SIZE, SCULPTURE_CYCLE_DELAY, SCULPTURE_CYCLE_DURATION } from "./configs.js";
import * as THREE from "three";
import { EDOSTEPS_TO_FIFTHS_MAP, HarmonicCoordinates } from "./just-intonation.js";

/**
 * Represents a ball in the sculpture.
 */
export class SculptureBall {
    /**
     * @type {THREE.SphereGeometry}
     */
    #geometry;
    /**
     * @type {THREE.MeshBasicMaterial}
     */
    #material;
    /**
     * @type {THREE.Mesh}
     */
    #mesh;
    /**
     * The time (in ms) when this note was activated.
     * 
     * @type {number}
     */
    timeOn;

    /**
     * A number from 0 - 1 representing how near the start/end of the sculpture (in time dimension) 
     * this ball is.
     * 
     * Stores the memoized value of `timeOn / lastBallTimeOn`.
     * 
     * @type {number}
     */
    timePosition;

    /**
     * The color of this ball.
     * 
     * @type {THREE.Color}
     */
    color;

    hue;
    saturation = 1;
    lightness;

    get mesh() {
        return this.#mesh;
    }

    /**
     * 
     * @param {number} timeOn 
     * @param {number} stepsFromA 
     * @param {HarmonicCoordinates} harmCoords 
     */
    constructor(timeOn, stepsFromA, harmCoords) {
        this.timeOn = timeOn;

        let edosteps = mod(stepsFromA, EDO);
        this.hue = MIN_FIFTH_HUE + (MAX_FIFTH_HUE - MIN_FIFTH_HUE) * EDOSTEPS_TO_FIFTHS_MAP[edosteps] / EDO;
        this.lightness = 0.4;
        this.color = new THREE.Color().setHSL(this.hue, this.saturation, this.lightness);

        this.#geometry = new THREE.SphereGeometry(SCULPTURE_BALL_SIZE, 12, 12);
        this.#material = new THREE.MeshBasicMaterial({
            color: this.color,
            reflectivity: 0.3,
            opacity: 1,
            transparent: true,
        });
        this.#mesh = new THREE.Mesh(this.#geometry, this.#material);
        this.#mesh.position.set(...harmCoords.toUnscaledCoords());
        scene.add(this.#mesh);
    }

    /**
     * Update the sculpture ball.
     * 
     * @param {number} progress a number from 0-1 representing the animation cycle progress.
     * @param {number} lastBallTimeOn the timeOn (ms) of the last ball in the sculpture.
     */
    tick(progress, lastBallTimeOn) {
        this.timePosition = this.timePosition || (this.timeOn / lastBallTimeOn);
        /**
         * A number from 0 - 1 indicating amount of emphasis on this ball.
         */
        let intensity = Math.cos(2 * Math.PI * (progress - this.timePosition)) / 2 + 0.5;
        this.#material.color.setHSL(
            this.hue, 
            0.6 + 0.4 * Math.pow(intensity, 20),
            0.1 + 0.3 * Math.pow(intensity, 20));
        this.#material.opacity = 0.03 + 0.4 * Math.pow(intensity, 30);
    }
}

/**
 * A Sculpture of the entire recorded lattice.
 * 
 * An animated fast-forwarded zoomed out 'traversal' of the harmonic space traversed.
 */
export class Sculpture {
    /**
     * List of balls
     * 
     * @type {SculptureBall[]}
     */
    balls = [];

    /**
     * Stores the final ball's timeOn.
     */
    lastBallTimeOn = 0;

    /**
     * the center of the sculpture.
     * 
     * @type {THREE.Vector3}
     */
    centroid = new THREE.Vector3();

    /**
     * Create a sculpture from a recording.
     * 
     * Use `window.beginRecording()` and `window.endRecording()` in the console to record a piece
     * copy the JSON data from the console and put it into `./recording.json`.
     * 
     * @param {[{timeOn: number, stepsFromA: number, harmCoords: {p2: number, p3: number, p5: number, p7: number, p11: number}}]} recording The JSON data of the recorded piece. 
     */
    constructor(recording) {
        for (let {timeOn, stepsFromA, harmCoords} of recording) {
            let newBall = new SculptureBall(timeOn, stepsFromA, HarmonicCoordinates.fromJSON(harmCoords));
            this.balls.push(newBall);
            this.centroid.add(newBall.mesh.position);
            if (timeOn > this.lastBallTimeOn) {
                this.lastBallTimeOn = timeOn + SCULPTURE_CYCLE_DELAY;
            }
        }
        this.centroid.divideScalar(this.balls.length);
    }

    tick() {
        let progress = (Date.now() % (1000 * SCULPTURE_CYCLE_DURATION)) / (1000 * SCULPTURE_CYCLE_DURATION);
        let avgTimePos = 0;
        // console.log(progress);
        for (let ball of this.balls) {
            ball.tick(progress, this.lastBallTimeOn);
            avgTimePos += ball.timePosition;
        }
        avgTimePos /= this.balls.length;
    }
}