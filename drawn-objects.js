import { Text } from "troika-three-text";
import { BALL_SIZE, BALL_SUSTAIN_SCALE_FACTOR, CAM_ROT_ACCEL, CAM_ROT_SPEED, CAM_SPEED, CAM_SPEED_HAPPENINGNESS, DIST_CHANGE_SPEED, DIST_STD_DEV_RATIO, EDO, FIFTHS_COLOR, HARMONIC_CENTER_SPEED, HARMONIC_CENTER_SPEED_HAPPENINGNESS, HARMONIC_CENTROID_SIZE, JITTER_HAPPENINGNESS, LINE_THICKNESS, MAX_BALLS, MAX_CAM_DIST, MAX_CAM_ROT_SPEED, MAX_FIFTH_HUE, MIN_CAM_DIST, MIN_FIFTH_HUE, NON_CHORD_TONE_SAT_EFFECT, OCTAVES_COLOR, ORIGIN_SIZE, SCULPTURE_CAM_DIST, SCULPTURE_CAM_PHI_CYCLES, SCULPTURE_CAM_THETA_CYCLES, SCULPTURE_CYCLE_DURATION, SCULPTURE_MODE, SEPTIMAL_COLOR, SHOW_DEBUG_BALLS, TEXT_SIZE, TEXT_TYPE, THIRDS_COLOR, UNDECIMAL_COLOR } from "./configs.js";
import { HarmonicContext } from "./harmonic-context.js";
import { EDOSTEPS_TO_FIFTHS_MAP, HarmonicCoordinates } from "./just-intonation.js";
import * as THREE from "three";

/**
 * Adds jitter to a vector based on {@link HAPPENINGNESS}
 * 
 * @param {THREE.Vector3} vec Input vector.
 * @returns {THREE.Vector3} A new vector with jitter applied.
 */
function addJitter(vec) {
    return vec.clone()
        .add(new THREE.Vector3().random().multiplyScalar(Math.pow(HAPPENINGNESS, 2.3) * JITTER_HAPPENINGNESS));
}

/**
 * Wrapper around THREE's camera.
 * 
 * In 3D, camera always points at centerX/Y/Z and is located in terms of
 * spherical coordinates (radius, theta, phi) about the center point.
 */
export class Camera {
    /**
     * Three JS camera instance
     * 
     * @type {THREE.Camera}
     */
    camera;

    /** 
     * center represents 3D coords of tonal center
     * 
     * @type {THREE.Vector3}
     */
    targetCenter = new THREE.Vector3();
    /**
     * @type {THREE.Vector3}
     */
    center = new THREE.Vector3();

    /**
     * @type {number}
     * 
     * The rotation of the camera about the center point along the X-Z plane. (circling the Y axis)
     * For 3D.
     * 
     * 0: right of center
     * PI/2: in front of center
     * PI: left of center
     * 3PI/2: behind center
     * 
     * x = radius * sin(phi) * cos(theta)
     * z = radius * sin(phi) * sin(theta)
     */
    theta = 1/2*Math.PI; // start 'in front' of the center point

    /**
     * Stores current yaw rotation speed
     * 
     * @type {number}
     */
    dTheta = 0;

    /**
     * @type {number}
     * 
     * The Y rotation of the camera about the center point after applying theta rotation.
     * For 3D.
     * 
     * 0: directly above center
     * PI/2: center
     * PI: directly below center
     * 
     * y = radius * cos(phi)
     */
    phi = Math.PI * 0.65; // start under center point

    /**
     * @type {HarmonicContext}
     */
    #harmonicContext;

    // These zoom settings are for 3D
    dist = MIN_CAM_DIST;
    distTarget = MIN_CAM_DIST;

    /**
     * @type {THREE.PointLight}
     */
    pointLight;

    constructor(harmonicContext) {
        this.#harmonicContext = harmonicContext;
        this.camera = new THREE.PerspectiveCamera(
            SCULPTURE_MODE ? 75 : 50, 
            window.innerWidth / window.innerHeight, 
            1, 
            SCULPTURE_MODE ? 10000 : 1000);
        this.pointLight = new THREE.PointLight(0xffffff, 0, 0, 1.4);
        scene.add(this.pointLight);
    }

    /**
     * To be called when the window is resized
     */
    updateAspectRatio() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Update the camera's position.
     * 
     * @param {number} stdDeviation The stdDeviation of the {@link BallsManager}
     */
    tick(stdDeviation) {
        let dt = deltaTime > 1000 ? 1000 : deltaTime;
        if (!SCULPTURE_MODE) {
            [this.targetCenter.x, this.targetCenter.y, this.targetCenter.z] = this.#harmonicContext.tonalCenterUnscaledCoords;
            this.center.x += (this.targetCenter.x - this.center.x) * dt / 1000 * (1 + HAPPENINGNESS * CAM_SPEED_HAPPENINGNESS) * CAM_SPEED;
            this.center.y += (this.targetCenter.y - this.center.y) * dt / 1000 * (1 + HAPPENINGNESS * CAM_SPEED_HAPPENINGNESS) * CAM_SPEED;
            this.center.z += (this.targetCenter.z - this.center.z) * dt / 1000 * (1 + HAPPENINGNESS * CAM_SPEED_HAPPENINGNESS) * CAM_SPEED;
            
            this.distTarget = MIN_CAM_DIST + stdDeviation * DIST_STD_DEV_RATIO + HAPPENINGNESS * CAM_SPEED_HAPPENINGNESS;
            this.distTarget = Math.max(MIN_CAM_DIST, Math.min(MAX_CAM_DIST, this.distTarget));
            this.dist += (this.distTarget - this.dist) * dt / 1000 * DIST_CHANGE_SPEED;
        }

        // Calculate where the camera actually is positioned.
        let camX = this.center.x + this.dist * Math.sin(this.phi) * Math.cos(this.theta);
        let camY = this.center.y + this.dist * Math.cos(this.phi);
        let camZ = this.center.z + this.dist * Math.sin(this.phi) * Math.sin(this.theta);
        let camPosVec = new THREE.Vector3(camX, camY, camZ);
        this.camera.position.copy(camPosVec);
        this.camera.lookAt(this.center);

        if (!SCULPTURE_MODE) {
            // Calculate how to rotate depending on whether the target is left or right of
            // the current center point. (If left, rotate CCW, if right, rotate CW)
            let camToCenter = new THREE.Vector3().subVectors(this.center, camPosVec);
            let targetToCenter = new THREE.Vector3().subVectors(this.center, this.targetCenter);
            let cross = camToCenter.cross(targetToCenter);
            let crossDivNormalized = cross.dot(cross.clone().normalize()) * cross.y >= 0 ? 1 : -1;

            // Rotation speed in radians per second
            let targetRotSpd = HAPPENINGNESS * crossDivNormalized * CAM_ROT_SPEED;
            targetRotSpd = Math.min(MAX_CAM_ROT_SPEED, Math.abs(targetRotSpd)) * Math.sign(targetRotSpd);

            this.dTheta = CAM_ROT_ACCEL * targetRotSpd + (1 - CAM_ROT_ACCEL) * this.dTheta;
            
            this.theta += dt / 1000 * this.dTheta;
            if (this.theta > 2 * Math.PI) this.theta -= 2 * Math.PI;
            
            this.phi = 0.97 * this.phi + 0.03 * Math.PI * (0.65 - Math.pow(HAPPENINGNESS, 0.7) * 0.25);
            
            this.pointLight.position.set(camX, camY + 50, camZ);
            this.pointLight.intensity = 30 + 90 * (HAPPENINGNESS);
        } else {
            // In sculpture mode, the camera rotates theta once per N animation cycles.
            let currTime = Date.now();
            this.theta = (currTime / (1000 * SCULPTURE_CYCLE_DURATION * SCULPTURE_CAM_THETA_CYCLES) % 1) * 2 * Math.PI;
            this.phi = Math.PI * (0.5 + Math.sin(currTime / (1000 * SCULPTURE_CYCLE_DURATION * SCULPTURE_CAM_PHI_CYCLES) % 1 * 2 * Math.PI) * 0.1);
            this.dist = SCULPTURE_CAM_DIST + 50 * Math.sin(currTime / (1000 * SCULPTURE_CYCLE_DURATION * SCULPTURE_CAM_THETA_CYCLES) % 1 * 2 * Math.PI);
            this.pointLight.position.set(camX, camY, camZ);
            this.pointLight.intensity = 130;
        }
    }
}

export class Ball {
    /**
     * Absolute harmonic coordinates
     * 
     * @type {HarmonicCoordinates}
     */
    harmCoords;
    /**
     * Harmonic coordinates relative to the effective origin.
     */
    relativeHarmCoords;
    #presence; // Number from 0-1
    stepsFromA;
    /**
     * Position of the center of the ball
     * 
     * @type {THREE.Vector3}
     */
    pos = new THREE.Vector3();
    hue;
    saturation;
    /**
     * @type {THREE.Color}
     */
    ballColor;
    size;
    isChordTone = true;
    isDebug = false; // set this manuallyg to true if the ball is debug and has no relativeHarmCoords.

    /**
     * The sphere geometry
     * 
     * @type {THREE.SphereGeometry}
     */
    #geometry;

    /**
     * The material for the sphere
     * 
     * @type {THREE.MeshStandardMaterial}
     */
    #material;

    /**
     * The mesh representing the ball object
     * 
     * @type {THREE.Mesh}
     */
    #sphereMesh;

    /**
     * The troika text object
     * 
     * @type {Text}
     */
    #textDisplay;

    /**
     * Text object for the fraction bar
     * 
     * @type {Text}
     */
    #fractionBar;

    /**
     * Common setup between constructor and realive functions.
     * 
     * @param {HarmonicCoordinates} harmCoords 
     * @param {number} stepsFromA 
     * @param {number} presence 
     * @param {boolean} isDebug 
     */
    setup(harmCoords, stepsFromA, presence, isDebug) {
        this.isDebug = isDebug;
        this.harmCoords = harmCoords;
        this.#presence = presence;
        this.stepsFromA = stepsFromA;
        [this.pos.x, this.pos.y, this.pos.z] = this.harmCoords.toUnscaledCoords();
        let edosteps = mod(stepsFromA, EDO);
        let octaves = Math.floor(stepsFromA / EDO) + 4;
        this.hue = MIN_FIFTH_HUE + (MAX_FIFTH_HUE - MIN_FIFTH_HUE) * EDOSTEPS_TO_FIFTHS_MAP[edosteps] / EDO;
        this.saturation = .95 - .25 * (octaves - 2) / 5 // Let saturation start to fall at octave 2
        this.size = Math.pow(presence, 0.5);
    }

    constructor(harmCoords, stepsFromA, presence, isDebug = false) {
        this.setup(harmCoords, stepsFromA, presence, isDebug);
        this.ballColor = new THREE.Color();
        this.ballColor.setHSL(this.hue, this.saturation, this.lightness);
        
        this.#geometry = new THREE.SphereGeometry(BALL_SIZE, 24, 24);
        this.#material = new THREE.MeshStandardMaterial({
            color: this.ballColor,
            metalness: 0,
            roughness: 0.3,
            opacity: this.isDebug ? 0.4 : this.opacity,
            transparent: true,
            side: THREE.DoubleSide,
        });
        this.#sphereMesh = new THREE.Mesh(this.#geometry, this.#material);
        this.updateDrawing();

        scene.add(this.#sphereMesh);

        if (!this.isDebug) {   
            if (TEXT_TYPE !== 'none') {
                this.#textDisplay = new Text();
                this.#textDisplay.position.set(0, TEXT_TYPE === 'relfraction' ? -20 : -15, 0);
                this.#textDisplay.fontSize = this.size * TEXT_SIZE;
                this.#textDisplay.font = "./FiraSansExtralight-AyaD.ttf";
                this.#textDisplay.textAlign = 'center';
                this.#textDisplay.anchorX = 'center';
                this.#textDisplay.anchorY = 'middle';
                this.#sphereMesh.add(this.#textDisplay);
            }
            
            if (TEXT_TYPE === 'relfraction') {
                this.#fractionBar = new Text();
                this.#fractionBar.text = '_';
                this.#fractionBar.position.set(0, -21, 0);
                this.#fractionBar.fontSize = this.size * TEXT_SIZE;
                this.#fractionBar.font = "./FiraSansExtralight-AyaD.ttf";
                this.#fractionBar.textAlign = 'center';
                this.#fractionBar.anchorX = 'center';
                this.#fractionBar.anchorY = 'bottom';
                this.#sphereMesh.add(this.#fractionBar);
            }
        } else {
            this.#sphereMesh.renderOrder = -100;
        }
    }

    /**
     * Reactivate a dead ball and put in into the scene.
     * 
     * @param {HarmonicCoordinates} harmCoords 
     * @param {number} stepsFromA 
     * @param {number} presence
     * @returns {Ball} this instance
     */
    realive(harmCoords, stepsFromA, presence) {
        this.setup(harmCoords, stepsFromA, presence, false);
        this.ballColor.setHSL(this.hue, this.saturation, .36 + .29 * Math.pow(presence, 0.5));

        this.#material.opacity = this.isDebug ? 0.3 : this.opacity;
        this.updateDrawing();

        window.scene.add(this.#sphereMesh);
        return this;
    }

    get isDead() {
        return this.presence <= 0;
    }

    get presence() {
        return this.#presence;
    }

    get lightness() {
        return 0.42 + 0.14 * Math.pow(this.presence, 0.5);
    }

    get opacity() {
        return 0.3 + 0.5 * Math.pow(this.presence, 0.45);
    }

    /**
     * Call this whenever ball is to be set inactive.
     * 
     * Removes ball from scene and stops it from updating.
     */
    kill() {
        this.#presence = 0;
        window.scene.remove(this.#sphereMesh);
    }

    /**
     * Call this when a ball that is already in the scene/active is restruck again.
     */
    revitalize(presence) {
        this.#presence = presence;
    }

    updateDrawing() {
        this.#sphereMesh.scale.set(this.size, this.size, this.size);
        this.#sphereMesh.position.copy(addJitter(this.pos));
        this.#material.color.set(this.ballColor);
    }

    /**
     *
     * @param {KEYS_STATE} keyState
     * @param {HarmonicContext} harmonicContext
     */
    tick(keyState, harmonicContext) {
        if (this.isDead) return;

        this.isChordTone = harmonicContext.containsNote(this.stepsFromA);
        if (this.stepsFromA in keyState) {
            if (this.presence > BALL_SUSTAIN_SCALE_FACTOR)
                this.#presence = this.presence * (1 - (2 - HAPPENINGNESS) * deltaTime / 1000);
            else if (this.presence < BALL_SUSTAIN_SCALE_FACTOR)
                this.#presence = BALL_SUSTAIN_SCALE_FACTOR;
        } else {
            this.#presence = this.presence * (1 - 2 * deltaTime / 1000) - 0.01 * deltaTime / 1000;
        }

        if (this.isDead) {
            this.kill();
            return;
        }

        let nonChordToneMult = this.isChordTone ? 1 : NON_CHORD_TONE_SAT_EFFECT;

        this.ballColor.setHSL(
            this.hue, 
            this.saturation * nonChordToneMult, 
            this.lightness,
        );

        this.#material.opacity = this.opacity;
        this.#material.roughness = 0.3 + 0.3 * HAPPENINGNESS;
        this.size = Math.pow(this.presence, 0.5);
        [this.pos.x, this.pos.y, this.pos.z] = this.harmCoords.toUnscaledCoords();

        this.updateDrawing();

        this.relativeHarmCoords = harmonicContext.relativeToEffectiveOrigin(this.harmCoords);

        let textColor = this.ballColor.clone().offsetHSL(0, 0, 0.2);

        if (this.#fractionBar) {
            this.#fractionBar.color = textColor;
            this.#fractionBar.lookAt(window.cam.camera.position);
            this.#fractionBar.strokeOpacity = this.opacity;
            this.#fractionBar.sync();
        }

        if (this.#textDisplay) {
            if (TEXT_TYPE === 'relfraction') {
                let [num, den] = this.relativeHarmCoords.toRatio();
                this.#textDisplay.text = `${num}\n${den}`;
            } else if (TEXT_TYPE === 'relmonzo') {
                this.#textDisplay.text = this.relativeHarmCoords.toMonzoString();
            }
            this.#textDisplay.color = textColor;
            this.#textDisplay.lookAt(window.cam.camera.position);
            this.#textDisplay.strokeOpacity = this.opacity;
            this.#textDisplay.sync();
        }
    }
}

export class BallsManager {
    /**
     * Represents active balls indexed by their harmonic coordinates
     * 
     * @type {Object.<HarmonicCoordinates, Ball>}
     */
    balls = {};

    /**
     * Contains list of inactive ball objects
     * 
     * @type {[Ball]}
     */
    #listOfDeadBalls = [];

    /**
     * The mean of the standard deviation of the x, y (and z, if 3D) coordinates of the balls.
     */
    #stddev = 0;

    /**
     * Ball for showing where the origin is.
     * 
     * @type {Ball}
     */
    originBall;

    /**
     * Ball for showing where the harmonic center is.
     * 
     * @type {Ball}
     */
    harmonicCenterBall;

    constructor() {
        this.originBall = new Ball(new HarmonicCoordinates(0,0,0,0,0), 0, ORIGIN_SIZE, true);
        this.originBall.ballColor = new THREE.Color(0xEEEEEE);
        this.originBall.updateDrawing();

        this.harmonicCenterBall = new Ball(new HarmonicCoordinates(0,0,0,0,0), 0, HARMONIC_CENTROID_SIZE, true);
    }

    /**
     *
     * @param {HarmonicCoordinates} harmCoords
     * @param {number} stepsFromA
     * @param {number} velocity
     * @returns {Ball} The ball that was created/reused
     */
    noteOn(harmCoords, stepsFromA, velocity) {
        // console.log('ball note on: ', harmCoords.toMonzoString(), stepsFromA, harmCoords);
        let presence = Math.pow(velocity / 127, 1) * 0.9 + 0.1;
        /** @type {Ball} */
        let existingBall = this.balls[harmCoords];
        if (existingBall !== undefined) {
            existingBall.revitalize(presence);
            return existingBall;
        } else {
            let keys = Object.keys(this.balls);
            if (this.#listOfDeadBalls.length > 0 || keys.length >= MAX_BALLS) {
                // Reuse a dead ball whenever possible/necessary

                /** @type {Ball} */
                let oldBall = this.#listOfDeadBalls.pop();
                if (!oldBall) {
                    // if there aren't any dead balls, but MAX_BALLS are exceeded,
                    // delete a random ball to re-use.
                    let randomKey = keys[Math.floor(Math.random() * keys.length)];
                    this.deleteBall(randomKey);
                    oldBall = this.#listOfDeadBalls.pop();
                }
                oldBall.realive(harmCoords, stepsFromA, presence);

                // if there was already an existing ball object in the new location for some reason,
                // put it into the reserve to prevent memory leaks.
                this.deleteBall(harmCoords);

                // put the revived old ball in the active list.
                this.balls[harmCoords] = oldBall;
                return oldBall;
            }

            // otherwise, just make a new ball.
            let ball = new Ball(harmCoords, stepsFromA, presence);
            // if there was already a ball object in this new location for some reason,
            // delete it.
            this.deleteBall(harmCoords);
            this.balls[harmCoords] = ball;
            return ball;
        }
    }

    /**
     * Deletes an active ball at given harmonic coordinate.
     * 
     * Doesn't actually delete it, just moves the ball object into the reserve
     * 
     * @param {HarmonicCoordinates} harmCoords 
     */
    deleteBall(harmCoords) {
        if (this.balls[harmCoords]) {
            this.balls[harmCoords].kill();
            this.#listOfDeadBalls.push(this.balls[harmCoords]);
            delete this.balls[harmCoords];
        }
    }

    /**
     * 
     * @param {Object.<number, KeyState>} keyState
     * @param {HarmonicContext} harmonicContext 
     */
    tick(keyState, harmonicContext) {
        let xValues = [], yValues = [], zValues = [];
        Object.entries(this.balls).forEach(
            ([key, ball]) => {
                ball.tick(keyState, harmonicContext);
                
                if (ball.isDead) {
                    this.deleteBall(ball.harmCoords);
                    return;
                }

                if (ball.harmCoords != key) {
                    console.warn('ball key mismatch: ', ball.harmCoords, key);
                }

                xValues.push(ball.pos.x);
                yValues.push(ball.pos.y);
                zValues.push(ball.pos.z);
            }
        );
        if (xValues.length !== 0) {
            this.#stddev = (math.std(xValues) + math.std(yValues) + math.std(zValues)) / 3;
        }
        else
            this.#stddev = 0;

        if (SHOW_DEBUG_BALLS) {
            [this.harmonicCenterBall.pos.x, this.harmonicCenterBall.pos.y, this.harmonicCenterBall.pos.z] = harmonicContext.tonalCenterUnscaledCoords;
            let hue = MIN_FIFTH_HUE + harmonicContext.centralFifth / EDO * (MAX_FIFTH_HUE - MIN_FIFTH_HUE);
            this.harmonicCenterBall.ballColor.setHSL(hue, 0.9, 0.6);
            this.harmonicCenterBall.updateDrawing();
            this.originBall.updateDrawing();
        }
    }

    get stdDeviation() {
        return this.#stddev;
    }

    /**
     * Retrieves total amount of ball objects in memory including inactive/dead balls.
     */
    get numBallObjects() {
        return Object.keys(this.balls).length + this.#listOfDeadBalls.length;
    }

    /**
     * Retrieves current number of balls active.
     */
    get numBallsAlive() {
        return Object.keys(this.balls).length;
    }
}

export class KeyCenterParticleFountain {
    
    /**
     * Position of the particle emitter
     * 
     * @type {THREE.Vector3}
     */
    pos = new THREE.Vector3();

    /**
     * A number from {@link MIN_FIFTH_HUE} to {@link MAX_FIFTH_HUE} representing the hue of the fountain.
     */
    hue;

    /**
     * @type {Nebula.System}
     */
    system;

    /**
     * @type {Nebula.Emitter}
     */
    emitter;

    /**
     * @type {Nebula.SpriteRenderer}
     */
    particleRenderer;

    /**
     * @type {THREE.Sprite}
     */
    sprite;

    /**
     * @type {THREE.PointLight}
     */
    pointLight;


    constructor() {
        this.system = new Nebula.System(THREE);
        this.emitter = new Nebula.Emitter();
        this.particleRenderer = new Nebula.SpriteRenderer(window.scene, THREE);

        let spriteMap = new THREE.TextureLoader().load('./dot.png');
        let material = new THREE.SpriteMaterial({
            map: spriteMap,
            color: 0xffffff,
            blending: THREE.AdditiveBlending,
            fog: true
        });
        this.sprite = new THREE.Sprite(material);

        this.emitter
            .setRate(new Nebula.Rate(new Nebula.Span(5, 10), new Nebula.Span(0.01, 0.03)))
            .addInitializers([
                new Nebula.Body(this.sprite),
                new Nebula.Mass(1),
                new Nebula.Life(1, 3),
                new Nebula.Radius(0, 2),
                new Nebula.Position(new Nebula.SphereZone(0,0,0,1)), // x, y, z, radius
            ])
            .addBehaviours([
            ])
            .setPosition({
                x: 0, y: 0, z: 0
            })
            .emit();
        
        this.system
            .addEmitter(this.emitter)
            .addRenderer(this.particleRenderer)
            .emit({});
        
        this.pointLight = new THREE.PointLight(0xffffff, 0, 0, 1);
        scene.add(this.pointLight);
    }

    /**
     * @param {HarmonicContext} harmonicContext
     * @param {number} dRotator
     * @param {Camera} camera
     */
    tick(harmonicContext) {
        this.hue = MIN_FIFTH_HUE + harmonicContext.centralFifth / EDO * (MAX_FIFTH_HUE - MIN_FIFTH_HUE);

        let [targetX, targetY, targetZ] = harmonicContext.tonalCenterUnscaledCoords;
        this.pos.x += (targetX - this.pos.x) * deltaTime / 1000 * (1 + HAPPENINGNESS * HARMONIC_CENTER_SPEED_HAPPENINGNESS) * HARMONIC_CENTER_SPEED;
        this.pos.y += (targetY - this.pos.y) * deltaTime / 1000 * (1 + HAPPENINGNESS * HARMONIC_CENTER_SPEED_HAPPENINGNESS) * HARMONIC_CENTER_SPEED;
        this.pos.z += (targetZ - this.pos.z) * deltaTime / 1000 * (1 + HAPPENINGNESS * HARMONIC_CENTER_SPEED_HAPPENINGNESS) * HARMONIC_CENTER_SPEED;

        let color = new THREE.Color().setHSL(this.hue, 0.6 + 0.4 * HAPPENINGNESS, 0.4 + 0.2 * HAPPENINGNESS);
        this.emitter.setPosition({
            x: this.pos.x,
            y: this.pos.y,
            z: this.pos.z
        }).setBehaviours([
            new Nebula.Alpha(0.08 + 0.13 * HAPPENINGNESS, 0 + 0.04 * HAPPENINGNESS, Infinity, Nebula.ease.easeInSine),
            new Nebula.RandomDrift(1 + 1 * HAPPENINGNESS, 1 + 1 * HAPPENINGNESS, 1 + 1 * HAPPENINGNESS, 0.1),
            new Nebula.Repulsion(this.pos, 0.1 + 0.3 * HAPPENINGNESS * HAPPENINGNESS, BALL_SIZE*2, Infinity, Nebula.ease.easeInQuad),
            new Nebula.Scale(new Nebula.Span(2 + HAPPENINGNESS, 1), 0),
            new Nebula.Color(
                color, 
                new THREE.Color().setHSL(this.hue, 0.3 + 0.3 * HAPPENINGNESS, 0.5 + 0.2 * HAPPENINGNESS), 
                Infinity, Nebula.ease.easeOutSine)
        ]).setInitializers([
            new Nebula.Body(this.sprite),
            new Nebula.Mass(1),
            new Nebula.Life(1 + 1 * HAPPENINGNESS, 2 + 2 * HAPPENINGNESS),
            new Nebula.Radius(0 + HAPPENINGNESS, 1.5 + 1.6 * HAPPENINGNESS),
            new Nebula.Position(new Nebula.SphereZone(0,0,0, 1 + 13 * HAPPENINGNESS)), // x, y, z, radius
            new Nebula.RadialVelocity(5, new Nebula.Vector3D(0, 1, 1), 2)
        ]);
        this.system.update(deltaTime/1000);

        this.pointLight.position.copy(this.pos);
        this.pointLight.color.set(color).addScalar(0.3);
        this.pointLight.intensity = 200 + 2000 * Math.pow(HAPPENINGNESS, 2.5);
    }

    get numParticles() {
        return this.system.getCount();
    }
}

export class Scaffolding {

    /** 
     * Contains the most recent Ball object which requires the existence of this line. 
     * 
     * @type {Ball}
     */
    reasonForExisting;

    /**
     * @type {THREE.Vector3}
     */
    from = new THREE.Vector3();
    
    /**
     * @type {THREE.Vector3}
     */
    to = new THREE.Vector3();

    /**
     * @type {HarmonicCoordinates}
     */
    fromHarmCoords;
    /**
     * @type {HarmonicCoordinates}
     */
    toHarmCoords;
    thickness = LINE_THICKNESS;
    color;
    adjacency;
    presence;

    /**
     * Contains the geometry of the cylinder
     * 
     * @type {THREE.CylinderGeometry}
     */
    #geometry;

    /**
     * Contains the line material
     * 
     * @type {THREE.MeshStandardMaterial}
     */
    #material;

    /**
     * Contains cylinder mesh
     * 
     * @type {THREE.Mesh}
     */
    #mesh;

    /**
     * Common setup between scaffolding constructor and realive methods
     * 
     * @param {HarmonicCoordinates} from 
     * @param {HarmonicCoordinates} to 
     * @param {Ball} reasonForExisting 
     */
    setup(from, to, reasonForExisting) {
        this.adjacency = from.checkAdjacent(to);
        if(this.adjacency === 0) {
            console.log(from, to);
            throw 'Attempted to construct scaffolding between non-adjacent coordinates'
        }

        this.reasonForExisting = reasonForExisting;
        this.presence = this.reasonForExisting.presence;
        this.fromHarmCoords = from;
        this.toHarmCoords = to;
        [this.from.x, this.from.y, this.from.z] = from.toUnscaledCoords();
        [this.to.x, this.to.y, this.to.z] = to.toUnscaledCoords();

        switch (this.adjacency) {
            case 2:
            case -2:
                // Octaves are very plain, nearly white with light blue tint
                this.color = OCTAVES_COLOR;
                break;
            case 3:
            case -3:
                // fifths are peach
                this.color = FIFTHS_COLOR;
                break;
            case 5:
            case -5:
                // thirds are mint green
                this.color = THIRDS_COLOR;
                break;
            case 7:
            case -7:
                // blue notes are blue
                this.color = SEPTIMAL_COLOR;
                break;
            case 11:
            case -11:
                // 11-limit notes are rusty
                this.color = UNDECIMAL_COLOR;
                break;
        }

        // this.color.setAlpha(Math.pow(this.presence, 0.8));
        this.thickness = Math.pow(this.presence, 0.9) * (LINE_THICKNESS + 0.2 * HAPPENINGNESS);
    }

    /**
     *
     * @param {HarmonicCoordinates} from
     * @param {HarmonicCoordinates} to
     * @param {Ball} reasonForExisting
     */
    constructor(from, to, reasonForExisting) {
        this.setup(from, to, reasonForExisting);

        this.#geometry = new THREE.CylinderGeometry(
            1, 
            1, 
            1, // default height to 1, scale later 
            8, // no. radial segments
        );

        this.#material = new THREE.MeshStandardMaterial({
            color: this.color,
            metalness: 0,
            roughness: 0.5,
            transparent: true,
            opacity: 0.5,
        });

        this.#mesh = new THREE.Mesh(this.#geometry, this.#material);
        window.scene.add(this.#mesh);
    }

    /**
     * Re-activates this scaffolding.
     * 
     * @param {HarmonicCoordinates} from 
     * @param {HarmonicCoordinates} to 
     * @param {Ball} reasonForExisting 
     * @returns {Scaffolding} This instance
     */
    realive(from, to, reasonForExisting) {
        this.setup(from, to, reasonForExisting);
        window.scene.add(this.#mesh);
        return this;
    }

    /**
     * Call this to remove line from scene and stop updating.
     * 
     * If this is called even when the {@link reasonForExisting} is still alive,
     * the scaffolding will still be removed and will stop updating until {@link realive} is called.
     */
    kill() {
        this.presence = 0;
        window.scene.remove(this.#mesh);
    }

    tick() {
        if (this.isDead) return;
        this.presence = this.reasonForExisting.presence;

        if (this.isDead) {
            this.kill();
            return;
        }

        // this.color.setAlpha(Math.pow(this.presence, 0.8));
        this.thickness = Math.pow(this.presence, 0.9) * (1 + 0.2 * HAPPENINGNESS) * LINE_THICKNESS;
        [this.from.x, this.from.y, this.from.z] = this.fromHarmCoords.toUnscaledCoords();
        [this.to.x, this.to.y, this.to.z] = this.toHarmCoords.toUnscaledCoords();

        this.#material.color.set(this.color);
        this.#material.opacity = 0.1 + 0.5 * this.presence;
        this.#mesh.position.copy(addJitter(this.from.clone().add(this.to).divideScalar(2)));
        this.#mesh.scale.set(this.thickness, this.to.distanceTo(this.from) - BALL_SIZE * 0.3, this.thickness);;
        this.#mesh.lookAt(this.to);
        this.#mesh.rotateX(Math.PI / 2);
    }

    get isDead() {
        return this.presence <= 0;
    }
}

export class ScaffoldingManager {
    /** 
     * Mapping of [from, to] coordinates to scaffolding lines.
     * 
     * Only contains active lines.
     *
     * @type {Object.<string, Scaffolding>}
     */
    #lines = {};

    /**
     * Stores unused lines for reuse
     * 
     * @type {Scaffolding[]}
     */
    #deadLines = [];

    /**
     * returns the Scaffolding object from the internal repository of active lines
     * @param {HarmonicCoordinates} fromCoord
     * @param {HarmonicCoordinates} toCoord
     * @returns {?Scaffolding}
     */
    #getExistingLine(fromCoord, toCoord) {
        return this.#lines[[fromCoord, toCoord]] || this.#lines[[toCoord, fromCoord]] || null
    }

    /**
     * Inactivates a scaffolding line that connects the points from/toCoord.
     * 
     * The order of the two coordinates do not matter.
     * 
     * @param {HarmonicCoordinates} fromCoord 
     * @param {HarmonicCoordinates} toCoord 
     */
    #deleteLine(fromCoord, toCoord) {
        if (this.#lines[[fromCoord, toCoord]]) {
            this.#deadLines.push(this.#lines[[fromCoord, toCoord]]);
            this.#lines[[fromCoord, toCoord]].kill();
            delete this.#lines[[fromCoord, toCoord]];
        }
        if (this.#lines[[toCoord, fromCoord]]) {
            this.#deadLines.push(this.#lines[[toCoord, fromCoord]]);
            this.#lines[[toCoord, fromCoord]].kill();
            delete this.#lines[[toCoord, fromCoord]];
        }
    }

    #createLine(fromCoord, toCoord, reasonForExisting) {
        this.#deleteLine(fromCoord, toCoord);
        let newScaffolding = this.#deadLines.pop();
        if (newScaffolding) {
            newScaffolding.realive(fromCoord, toCoord, reasonForExisting);
        } else {
            newScaffolding = new Scaffolding(fromCoord, toCoord, reasonForExisting);
        }
        this.#lines[[fromCoord, toCoord]] = newScaffolding;
    }

    /**
     * NOTE: `ScaffoldingManager.tick()` should be called AFTER `BallsManager.tick()`.
     */
    tick() {
        Object.entries(this.#lines).forEach(
            ([k,line]) => {
                line.tick();
                if (line.isDead)
                    this.#deleteLine(line.fromHarmCoords, line.toHarmCoords);
            }
        );
    }

    /**
     * Create the necessary scaffolding between two places
     * 
     * @param {HarmonicCoordinates} fromHarmonicCoords
     * @param {Ball} toBall
     */
    create(fromHarmonicCoords, toBall) {
        let path = [];
        let cursor = fromHarmonicCoords;
        let destination = toBall.harmCoords;

        // populate path with adjacent coordinates to construct the scaffolding with
        while (true) {
            path.push(cursor);
            if (destination.p2 < cursor.p2)
                cursor = cursor.add(new HarmonicCoordinates(-1,0,0,0,0));
            else if (destination.p2 > cursor.p2)
                cursor = cursor.add(new HarmonicCoordinates(1,0,0,0,0));
            else if (destination.p3 < cursor.p3)
                cursor = cursor.add(new HarmonicCoordinates(0,-1,0,0,0));
            else if (destination.p3 > cursor.p3)
                cursor = cursor.add(new HarmonicCoordinates(0,1,0,0,0));
            else if (destination.p5 < cursor.p5)
                cursor = cursor.add(new HarmonicCoordinates(0,0,-1,0,0));
            else if (destination.p5 > cursor.p5)
                cursor = cursor.add(new HarmonicCoordinates(0,0,1,0,0));
            else if (destination.p7 < cursor.p7)
                cursor = cursor.add(new HarmonicCoordinates(0,0,0,-1,0));
            else if (destination.p7 > cursor.p7)
                cursor = cursor.add(new HarmonicCoordinates(0,0,0,1,0));
            else if (destination.p11 < cursor.p11)
                cursor = cursor.add(new HarmonicCoordinates(0,0,0,0,-1));
            else if (destination.p11 > cursor.p11)
                cursor = cursor.add(new HarmonicCoordinates(0,0,0,0,1));
            else
                break;
        }

        for (let i = 0; i < path.length - 1; i++) {
            let from = path[i];
            let to = path[i+1];

            this.#createLine(from, to, toBall);
        }
    }
}