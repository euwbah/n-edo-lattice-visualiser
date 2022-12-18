/**
 * 2D Algorithm:
 * Harmonic Coordinates -> Unscaled coordinates -> Projection -> Screen coordinates
 * 
 * 3D Algorithm:
 * Harmonic Coordinates -> Unscaled coordinates -> P5's 3D projection
 * 
 * In 3D, camera always points at centerX/Y/Z and is located in terms of
 * spherical coordinates (radius, theta, phi) about the center point.
 */
class Camera {
    targetCenterX = 0;
    targetCenterY = 0;
    targetCenterZ = 0;
    centerX = 0;
    centerY = 0;
    centerZ = 0; // +ve z is outward from the screen

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

    // These zoom settings are for 2D
    zoom = MAX_ZOOM;
    zoomTarget = MAX_ZOOM;
    #effectiveExponent = EXPONENT;

    // These zoom settings are for 3D
    dist = MIN_CAM_DIST;
    distTarget = MIN_CAM_DIST;

    constructor(harmonicContext) {
        this.#harmonicContext = harmonicContext;
    }

    get effectiveExponent() {
        return this.#effectiveExponent;
    }

    tick(stdDeviation, dRotator, graphics) {
        [this.targetCenterX, this.targetCenterY, this.targetCenterZ] = this.#harmonicContext.tonalCenterUnscaledCoords;
        let dt = deltaTime > 1000 ? 1000 : deltaTime;
        this.centerX += (this.targetCenterX - this.centerX) * dt / 1000 * (1 + HAPPENINGNESS * CAM_SPEED_HAPPENINGNESS) * CAM_SPEED;
        this.centerY += (this.targetCenterY - this.centerY) * dt / 1000 * (1 + HAPPENINGNESS * CAM_SPEED_HAPPENINGNESS) * CAM_SPEED;
        this.centerZ += (this.targetCenterZ - this.centerZ) * dt / 1000 * (1 + HAPPENINGNESS * CAM_SPEED_HAPPENINGNESS) * CAM_SPEED;

        if (!IS_3D) {
            // counter rotation:
            let [dX_dRot, dY_dRot] = this.#harmonicContext.dCenterCoords_dRotator;
            // move the camera an amount equal to the amount of translation caused by the
            // rotation of the vectors.
            // THIS WORKS. TRUST ME. IF YOU REMOVE THESE TWO LINES NOTHING WILL SHOW UP ON THE
            // SCREEN AFTER SPAMMING TONS OF NOTES.
            let dXDueToRot = dX_dRot * dRotator;
            let dYDueToRot = dY_dRot * dRotator;

            let rotLagX = - dXDueToRot * CAM_ROTATIONAL_LAG_COEF;
            let rotLagY = - dYDueToRot * CAM_ROTATIONAL_LAG_COEF;

            // Project the rotational lag as a vector from the current camera's position
            // and make sure it doesn't exceed the maximum lag in pixels.
            let [projRotLagX, projRotLagY] = this.project([rotLagX + this.centerX, rotLagY + this.centerY]);
            if (Math.abs(projRotLagX) > CAM_MAX_ROTATIONAL_LAG_X_PX)
                projRotLagX = CAM_MAX_ROTATIONAL_LAG_X_PX * Math.sign(projRotLagX);
            if (Math.abs(projRotLagY) > CAM_MAX_ROTATIONAL_LAG_Y_PX)
                projRotLagY = CAM_MAX_ROTATIONAL_LAG_Y_PX * Math.sign(projRotLagY);

            [rotLagX, rotLagY] = this.inverseProject([projRotLagX, projRotLagY]);
            rotLagX -= this.centerX; // Undo the offset that was included for calculation purposes
            rotLagY -= this.centerY;

            this.centerX += dXDueToRot + rotLagX;
            this.centerY += dYDueToRot + rotLagY;

            let targetExp = EXPONENT + HAPPENINGNESS * EXPONENT_GROWTH;
            this.#effectiveExponent += (targetExp - this.#effectiveExponent) * dt / 800;

            let scaledDeviation = (stdDeviation - MAX_ZOOM_STD_DEV) / (MIN_ZOOM_STD_DEV - MAX_ZOOM_STD_DEV);
            scaledDeviation = Math.max(0, Math.min(1, scaledDeviation));
            this.zoomTarget = (MIN_ZOOM + (MAX_ZOOM - MIN_ZOOM) * (1 - scaledDeviation)) * (1 - HAPPENINGNESS * ZOOM_SHRINK);
            this.zoomTarget = Math.max(1, this.zoomTarget); // 1 is the absolute minimum zoom
            this.zoom += (this.zoomTarget - this.zoom) * dt / 1000 * ZOOM_CHANGE_SPEED;
        } else {
            this.distTarget = MIN_CAM_DIST + stdDeviation * DIST_STD_DEV_RATIO + HAPPENINGNESS * 150;
            this.distTarget = Math.max(MIN_CAM_DIST, Math.min(MAX_CAM_DIST, this.distTarget));
            this.dist += (this.distTarget - this.dist) * dt / 1000 * DIST_CHANGE_SPEED;

            this.theta += dt / 1000 * HAPPENINGNESS * 2;
            if (this.theta > 2 * Math.PI) this.theta -= 2 * Math.PI;

            this.phi = 0.97 * this.phi + 0.03 * Math.PI * (0.65 - Math.pow(HAPPENINGNESS, 0.7) * 0.25);

            let camX = this.centerX + this.dist * Math.sin(this.phi) * Math.cos(this.theta);
            let camY = this.centerY + this.dist * Math.cos(this.phi);
            let camZ = this.centerZ + this.dist * Math.sin(this.phi) * Math.sin(this.theta);
            graphics.lightFalloff(0.5, 0.1, 0.1)
            graphics.pointLight(200, 200, 200, camX, camY, camZ);
            graphics.camera(
                camX, camY, camZ,
                this.centerX, this.centerY, this.centerZ,
                0, 1, 0 // up vector
            );
        }
    }

    /**
     * Project unscaled coordinates into cartesian coordinates from origin.
     * 
     * SHOULD NOT BE CALLED IF IN 3D MODE.
     * @param {[number, number]} unscaledCoordinates
     */
    project(unscaledCoordinates) {
        let [x, y] = unscaledCoordinates;
        x -= this.centerX;
        y -= this.centerY;

        if (PROJECTION_TYPE === 'exp2d') {
            x = Math.pow(Math.abs(x), this.effectiveExponent) * Math.sign(x);
            y = Math.pow(Math.abs(y), this.effectiveExponent) * Math.sign(y);
        } else if (PROJECTION_TYPE === 'exppolar') {
            let r = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
            let theta = Math.atan2(y, x);
            r = Math.pow(r, this.effectiveExponent); // r is always positive
            x = r * Math.cos(theta);
            y = r * Math.sin(theta);
        }

        x *= this.zoom;
        y *= this.zoom;

        return [x, y];
    }

    /**
     * Inverse of `project()` such that inverseProject(project([x, y])) returns [x, y]
     * @param {[number, number]} coords
     */
    inverseProject(coords) {
        let [x, y] = coords;
        x /= this.zoom;
        y /= this.zoom;

        if (PROJECTION_TYPE === 'exp2d') {
            x = Math.pow(Math.abs(x), 1 / this.effectiveExponent) * Math.sign(x);
            y = Math.pow(Math.abs(y), 1 / this.effectiveExponent) * Math.sign(y);
        } else if (PROJECTION_TYPE === 'exppolar') {
            let r = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
            let theta = Math.atan2(y, x);
            r = Math.pow(r, 1 / this.effectiveExponent); // r is always positive
            x = r * Math.cos(theta);
            y = r * Math.sin(theta);
        }

        x += this.centerX;
        y += this.centerY;
        return [x, y];
    }

    projectScalar(scalar, unscaledCoordinates) {
        // method: multiply the scalar by the average of d(project(x))/d(x) and d(project(y))/d(y)
        // d(project(x))/dx = ???
        // defined for all x except x = 0
        // if x = 0, use dx = zoom.
        let [x, y] = unscaledCoordinates;
        x = (x - this.centerX);
        y = (y - this.centerY);
        let dx = this.zoom, dy = this.zoom;
        if (PROJECTION_TYPE === 'exp2d') {
            // NOTE: if effectiveExponent < 1, dx -> infinity as x -> 0
            //       if effectiveExponent = 1, dx = 1 always.
            //       if effectiveExponent > 1, dx -> 0 as x -> 0.
            //       NOTE: never let effectiveExponent > 1.
            if (x !== 0) {
                /*
                d/dx projx(x) = zoom^exp * exp * x ^ (exp - 1)
                 */
                dx = Math.pow(this.zoom, this.effectiveExponent) * this.effectiveExponent * Math.pow(Math.abs(x), this.effectiveExponent - 1);
            }
            if (y !== 0) {
                dy = Math.pow(this.zoom, this.effectiveExponent) * this.effectiveExponent * Math.pow(Math.abs(y), this.effectiveExponent - 1);
            }

        } else if (PROJECTION_TYPE === 'exppolar') {
            let r1 = Math.pow(x, 2) + Math.pow(y, 2);
            let theta = Math.atan2(y, x);
            // NOTE: never let effectiveExponent > 2,
            if (r1 !== 0) {
                let dr2_dx = 2*Math.abs(x) * this.effectiveExponent/2 * Math.pow(r1, this.effectiveExponent/2 - 1);
                let dr2_dy = 2*Math.abs(y) * this.effectiveExponent/2 * Math.pow(r1, this.effectiveExponent/2 - 1);
                dx = Math.abs(Math.cos(theta)) * this.zoom * dr2_dx;
                dy = Math.abs(Math.sin(theta)) * this.zoom * dr2_dy;
            }
        }

        // Scalar zoom scaling is capped at zoom level.
        if (dx > this.zoom)
            dx = this.zoom;
        if (dy > this.zoom)
            dy = this.zoom;

        let dr = Math.min(this.zoom, Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2)));

        return scalar * dr;
    }

    toScreenCoordinates(cartesian) {
        // no need for windowWidth/height offset since we're using WEBGL renderer for global GRAPHICS.
        let jitter = Math.pow(Math.max(0, HAPPENINGNESS - 0.50) / (1 - 0.50), 1.7) * 10;
        return [cartesian[0] /*+ windowWidth/2*/ + (Math.random() - 0.5) * jitter,
                /*windowHeight/2*/ - cartesian[1] + (Math.random() - 0.5) * jitter];
    }
}

class Ball {
    /**
     * @type {HarmonicCoordinates}
     */
    harmCoords;
    relativeHarmCoords;
    presence; // Number from 0-1
    stepsFromA;
    x;
    y;
    z;
    hue;
    saturation;
    ballColor;
    sizeUnscaled;
    isChordTone = true;
    isDebug = false; // set this manuallyg to true if the ball is debug and has no relativeHarmCoords.

    constructor(harmCoords, stepsFromA, presence) {
        // Note: this is in Hue Saturation Brightness format
        this.harmCoords = harmCoords;
        this.presence = presence;
        this.stepsFromA = stepsFromA;
        [this.x, this.y, this.z] = this.harmCoords.toUnscaledCoords();
        let edosteps = mod(stepsFromA, EDO);
        let octaves = Math.floor(stepsFromA / EDO) + 4;
        this.hue = MIN_FIFTH_HUE + (MAX_FIFTH_HUE - MIN_FIFTH_HUE) * EDOSTEPS_TO_FIFTHS_MAP[edosteps] / EDO;
        this.saturation = 95 - 25 * (octaves - 2) / 5 // Let saturation start to fall at octave 2
        this.ballColor = color(this.hue, this.saturation, 100 * Math.pow(presence, 0.5), 0.9);
        this.sizeUnscaled = Math.pow(presence, 0.5) * BALL_SIZE;
    }

    /**
     *
     * @param {KEYS_STATE} keyState
     * @param {HarmonicContext} harmonicContext
     */
    tick(keyState, harmonicContext) {
        this.isChordTone = harmonicContext.containsNote(this.stepsFromA);
        if (this.stepsFromA in keyState) {
            if (this.presence > BALL_SUSTAIN_SCALE_FACTOR)
                this.presence = this.presence * (1 - (2 - HAPPENINGNESS) * deltaTime / 1000);
            else if (this.presence < BALL_SUSTAIN_SCALE_FACTOR)
                this.presence = BALL_SUSTAIN_SCALE_FACTOR;
        } else {
            this.presence = this.presence * (1 - 2 * deltaTime / 1000) - 0.01 * deltaTime / 1000;
        }

        let nonChordToneMult = this.isChordTone ? 1 : NON_CHORD_TONE_SAT_EFFECT;

        this.ballColor = color(
            this.hue, 
            this.saturation * nonChordToneMult, 
            this.presence * 40 + 40, 
            0.7 * Math.pow(this.presence, 0.5)
        );
        this.sizeUnscaled = Math.pow(this.presence, 0.5) * BALL_SIZE;

        [this.x, this.y, this.z] = this.harmCoords.toUnscaledCoords();

        this.relativeHarmCoords = harmonicContext.relativeToEffectiveOrigin(this.harmCoords);
    }

    /**
     *
     * @param {Camera} camera
     * @param {p5.Graphics} graphics
     */
    draw(camera, graphics) {
        if (!IS_3D) {
            let unscaledCoords = [this.x, this.y];
            let [x, y] = camera.toScreenCoordinates(camera.project(unscaledCoords));
            let size = camera.projectScalar(this.sizeUnscaled * (this.isChordTone ? 1 : NON_CHORD_TONE_SIZE_EFFECT), unscaledCoords);
            graphics.noStroke();
            graphics.fill(this.ballColor);
            graphics.circle(x, y, size);
            
            if (!this.isDebug) {
                graphics.fill(hue(this.ballColor), 35, 100, 1);
                graphics.textAlign(CENTER, CENTER);
                let tSize = Math.max(MIN_TEXT_SIZE_PX, Math.min(MAX_TEXT_SIZE_PX, size * 0.6));
                graphics.textSize(tSize);
                if (TEXT_TYPE === 'relmonzo') {
                    graphics.text(this.relativeHarmCoords.toMonzoString(), x, y + size);
                } else if (TEXT_TYPE === 'relfraction') {
                    let [num, den] = this.relativeHarmCoords.toRatio();
                    graphics.text(num, x, y + size - 5);
                    graphics.text(`__`, x, y + size - 5 + tSize * 0.1);
                    graphics.text(den, x, y + size - 5 + tSize);
                }
            }
        } else {
            graphics.push();
            let size = this.sizeUnscaled * 10;
            graphics.translate(this.x, this.y, this.z);
            graphics.specularMaterial(this.ballColor);
            graphics.shininess(80);
            graphics.sphere(this.isDebug ? size * 0.5 : size);
            
            if (!this.isDebug) {
                graphics.fill(hue(this.ballColor), 35, 100, 1);
                graphics.textAlign(CENTER, CENTER);
                let tSize = 0;
                graphics.textSize(tSize);
                graphics.translate(0, -10, 0);
                if (TEXT_TYPE === 'relmonzo') {
                    graphics.text(this.relativeHarmCoords.toMonzoString(), 0, -5);
                } else if (TEXT_TYPE === 'relfraction') {
                    let [num, den] = this.relativeHarmCoords.toRatio();
                    graphics.text(num, 0, -5);
                    graphics.text(`__`, 0, -5 + tSize * 0.1);
                    graphics.text(den, 0, -5 + tSize);
                }
            }
            graphics.pop();
        }
    }
}

class BallsManager {
    /**
     * @type {Object.<HarmonicCoordinates, Ball>}
     */
    balls = {};
    /**
     * The mean of the standard deviation of the x, y (and z, if 3D) coordinates of the balls.
     */
    #stddev = 0;
    originBall;
    harmonicCenterBall;

    constructor() {

    }

    setup() {
        this.originBall = new Ball(new HarmonicCoordinates(0,0,0,0,0), 0, 0.1);
        this.originBall.ballColor = color(0, 10, 80, 0.3);
        this.originBall.isDebug = true;

        this.harmonicCenterBall = new Ball(new HarmonicCoordinates(0,0,0,0,0), 0, 0.05);
        this.harmonicCenterBall.ballColor = color(0, 70, 100, 0.5);
        this.harmonicCenterBall.isDebug = true;
    }

    /**
     *
     * @param {HarmonicCoordinates} harmCoords
     * @param {number} stepsFromA
     * @param {number} velocity
     * @returns {Ball} The ball that was created
     */
    noteOn(harmCoords, stepsFromA, velocity) {
        console.log('ball note on: ', harmCoords.harmonicDistanceFromOrigin(), harmCoords);
        let presence = Math.pow(velocity / 127, 0.5) * 0.5 + 0.5;
        let existingBall = this.balls[harmCoords];
        if (existingBall !== undefined) {
            existingBall.presence = Math.pow(velocity / 127, 0.5) * 0.5 + 0.5;
            return existingBall;
        } else {
            let ball = new Ball(harmCoords, stepsFromA, presence);
            this.balls[harmCoords] = ball;
            return ball;
        }
    }

    tick(keyState, harmonicContext) {
        let xValues = [], yValues = [], zValues = [];
        this.balls = Object.fromEntries(Object.entries(this.balls).filter(
            ([_,ball]) => {
                ball.tick(keyState, harmonicContext);
                xValues.push(ball.x);
                yValues.push(ball.y);
                zValues.push(ball.z);
                return ball.presence > 0;
            }
        ));
        if (xValues.length !== 0) {
            if (!IS_3D)
                this.#stddev = (math.std(xValues) + math.std(yValues)) / 2;
            else
                this.#stddev = (math.std(xValues) + math.std(yValues) + math.std(zValues)) / 3;
        }
        else
            this.#stddev = 0;

        if (SHOW_DEBUG_BALLS) {
            [this.harmonicCenterBall.x, this.harmonicCenterBall.y] = harmonicContext.tonalCenterUnscaledCoords;
            let hue = MIN_FIFTH_HUE + harmonicContext.centralFifth / EDO * (MAX_FIFTH_HUE - MIN_FIFTH_HUE);
            this.harmonicCenterBall.ballColor = color(hue, 70, 100, 0.5);
        }
    }

    /**
     *
     * @param {Camera} camera
     * @param {p5.Graphics} graphics buffer to draw to
     */
    draw(camera, graphics) {
        if (SHOW_DEBUG_BALLS) {
            this.originBall.draw(camera, graphics);
            this.harmonicCenterBall.draw(camera, graphics);
        }
        
        for (const [_, ball] of Object.entries(this.balls)) {
            ball.draw(camera, graphics);
        }
    }

    get stdDeviation() {
        return this.#stddev;
    }

    get numBalls() {
        return Object.keys(this.balls).length;
    }
}

class Particle {
    x; y; z;
    dx; dy; dz;
    life;
    color;
    size;
    hue;

    constructor(x, y, z, dx, dy, dz, hue) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.dx = dx;
        this.dy = dy;
        this.dz = dz;
        this.life = 1;
        this.hue = hue;
        this.color = color(
            this.hue,
            100 * Math.pow((1 - this.life), 2),
            50 + 50 * this.life,
            Math.pow(this.life, 0.7));
        this.size = (PARTICLE_MIN_SIZE + HAPPENINGNESS * (PARTICLE_MAX_SIZE - PARTICLE_MIN_SIZE)) * Math.pow(this.life, 0.7);
    }

    /**
     * Use this function to reuse particle objects. Save the GC.
     */
    realive(x, y, z, dx, dy, dz, hue) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.dx = dx;
        this.dy = dy;
        this.dz = dz;
        this.life = 1;
        this.hue = hue;
        this.color = color(
            this.hue,
            100 * Math.pow((1 - this.life), 2),
            50 + 50 * this.life,
            Math.pow(this.life, 0.7));
        this.size = (PARTICLE_MIN_SIZE + HAPPENINGNESS * (PARTICLE_MAX_SIZE - PARTICLE_MIN_SIZE)) * Math.pow(this.life, 0.7);
    }

    tick() {
        this.dx *= 1 - 0.5 * deltaTime/1000;
        this.dy *= 1 - 0.5 * deltaTime/1000;
        this.dz *= 1 - 0.5 * deltaTime/1000;
        this.x += this.dx * deltaTime / 1000;
        this.y += this.dy * deltaTime / 1000;
        this.z += this.dz * deltaTime / 1000;
        // 1 means fully alive and new
        // <= 0 means dead
        this.life -= deltaTime/1000 / PARTICLE_LIFE_SECS;

        if (!IS_3D) {
            this.color = color(
                this.hue,
                100 * Math.pow((1 - this.life), 0.5),
                50 + 50 * this.life,
                Math.pow(this.life, 0.7));
            this.size = (PARTICLE_MIN_SIZE + HAPPENINGNESS * (PARTICLE_MAX_SIZE - PARTICLE_MIN_SIZE)) * Math.pow(this.life, 0.7);
        }

        // 3d particles are drawn by the fountain
    }

    /**
     * Draw the particle (only do this in 2D mode)
     * In 3D, the particle fountain handles drawing
     */
    draw(camera, graphics) {
        if (this.life <= 0) return;

        if (!IS_3D) {
            let unscaledCoords = [this.x, this.y];
            let [x, y] = camera.toScreenCoordinates(camera.project(unscaledCoords));
            let size = camera.projectScalar(this.size, unscaledCoords);
            graphics.noStroke();
            graphics.fill(this.color);
            graphics.circle(x, y, size);
        } else {
            // do nothing
            // particle drawing handled by particle fountain to save on uniform state changes
        }
    }

    get isDead() {  return this.life <= 0; }
}

class KeyCenterParticleFountain {
    /**
     * @type {[Particle]}
     */
    particles = [];
    /**
     * Stores indexes of dead particles.
     */
    deadParticleIndices = [];
    x = 0; y = 0; z = 0;
    hue;

    /**
     * Create a new particle.
     * 
     * @param {HarmonicContext} harmonicContext 
     * @param {number} dXdueToRot only for 2d
     * @param {number} dYdueToRot only for 2d
     */
    #createNewParticle(dXdueToRot, dYdueToRot) {
        let speed = PARTICLE_MIN_SPEED + Math.random() * (PARTICLE_MAX_SPEED - PARTICLE_MIN_SPEED);
        let angle = Math.random() * Math.PI * 2;
        let dx = 0, dy = 0, dz = 0;
        if (!IS_3D) {
            dx = speed * Math.cos(angle);
            dy = speed * Math.sin(angle);

            dx += dXdueToRot * (1 - PARTICLE_ROTATIONAL_LAG_COEF);
            dy += dYdueToRot * (1 - PARTICLE_ROTATIONAL_LAG_COEF);
        } else {
            speed *= 20;
            let phi = Math.random() * Math.PI * 2;
            dx = speed * Math.cos(angle) * Math.sin(phi);
            dy = speed * Math.sin(angle) * Math.sin(phi);
            dz = speed * Math.cos(phi);
        }
        if (this.particles.length < MAX_PARTICLES)
            this.particles.push(new Particle(this.x, this.y, this.z, dx, dy, dz, this.hue));
        else {
            let deadParticleIdx = this.deadParticleIndices.pop() || Math.floor(Math.random() * this.particles.length);
            let particle = this.particles[deadParticleIdx];
            particle.realive(this.x, this.y, this.z, dx, dy, dz, this.hue);
        }
    }

    /**
     * @param {HarmonicContext} harmonicContext
     * @param {number} dRotator
     * @param {Camera} camera
     */
    tick(harmonicContext, dRotator, camera) {
        for (let i = 0; i < this.particles.length; i++) {
            let particle = this.particles[i];
            if (!particle.isDead) {
                particle.tick();
                // if particle died exactly during this tick, add its index to the dead
                // particle list so that it will be the first to be revived later on.
                if (particle.isDead) this.deadParticleIndices.push(i);
            }
        }

        this.hue = MIN_FIFTH_HUE + harmonicContext.centralFifth / EDO * (MAX_FIFTH_HUE - MIN_FIFTH_HUE);

        let [targetX, targetY, targetZ] = harmonicContext.tonalCenterUnscaledCoords;
        this.x += (targetX - this.x) * deltaTime / 1000 * (1 + HAPPENINGNESS * HARMONIC_CENTER_SPEED_HAPPENINGNESS) * HARMONIC_CENTER_SPEED;
        this.y += (targetY - this.y) * deltaTime / 1000 * (1 + HAPPENINGNESS * HARMONIC_CENTER_SPEED_HAPPENINGNESS) * HARMONIC_CENTER_SPEED;
        this.z += (targetZ - this.z) * deltaTime / 1000 * (1 + HAPPENINGNESS * HARMONIC_CENTER_SPEED_HAPPENINGNESS) * HARMONIC_CENTER_SPEED;

        let dxDueToRot = 0, dyDueToRot = 0;
        if (!IS_3D) {
            // counter rotation:
            let [dX_dRot, dY_dRot] = harmonicContext.dCenterCoords_dRotator;

            dxDueToRot = dX_dRot * dRotator;
            dyDueToRot = dY_dRot * dRotator;

            let rotLagX = - dxDueToRot * HARMONIC_CENTER_ROTATIONAL_LAG_COEF;
            let rotLagY = - dyDueToRot * HARMONIC_CENTER_ROTATIONAL_LAG_COEF;

            let [projRotLagX, projRotLagY] = camera.project([rotLagX + this.x, rotLagY + this.y]);
            if (Math.abs(projRotLagX) > HARMONIC_CENTER_MAX_ROTATIONAL_LAG_X_PX)
                projRotLagX = HARMONIC_CENTER_MAX_ROTATIONAL_LAG_X_PX * Math.sign(projRotLagX);
            if (Math.abs(projRotLagY) > HARMONIC_CENTER_MAX_ROTATIONAL_LAG_Y_PX)
                projRotLagY = HARMONIC_CENTER_MAX_ROTATIONAL_LAG_Y_PX * Math.sign(projRotLagY);

            [rotLagX, rotLagY] = camera.inverseProject([projRotLagX, projRotLagY]);
            rotLagX -= this.x;
            rotLagY -= this.y;

            this.x += dxDueToRot + rotLagX;
            this.y += dyDueToRot + rotLagY;
        }

        if (Math.random() > PARTICLE_MIN_CHANCE + HAPPENINGNESS * (PARTICLE_MAX_CHANCE - PARTICLE_MIN_CHANCE))
            this.#createNewParticle(dxDueToRot, dyDueToRot);
    }

    draw(camera, graphics) {
        if (IS_3D) {
            graphics.lightFalloff(0.5, 0.005, 0.015);
            graphics.pointLight(this.hue, 80, 100, this.x, this.y, this.z);

            // stores previous xyz translation value so that 
            // translations can be done relative
            let x = 0, y = 0, z = 0;

            // in 3D mode, particles are drawn here
            graphics.push();
            graphics.specularMaterial(this.hue, 80, 70, 0.7);
            graphics.shininess(60);
            this.particles.forEach(particle => {
                if (!particle.isDead) {
                    graphics.translate(particle.x - x, particle.y - y, particle.z - z);
                    x = particle.x;
                    y = particle.y;
                    z = particle.z;
                    graphics.sphere(particle.life * 2, 5, 5);
                }
            });
            graphics.pop();
        } else {
            for (let particle of this.particles) {
                particle.draw(camera, graphics);
            }
        }
    }

    get numParticles() {
        return this.particles.length;
    }
}

class Scaffolding {
    reasonForExisting; // Contains the most recent Ball object which requires the existence of this line.
    fromX;
    fromY;
    fromZ;
    toX;
    toY;
    toZ;
    fromHarmCoords;
    toHarmCoords;
    thickness = LINE_THICKNESS;
    color;
    adjacency;
    presence;

    /**
     *
     * @param {HarmonicCoordinates} from
     * @param {HarmonicCoordinates} to
     * @param {Ball} reasonForExisting
     */
    constructor(from, to, reasonForExisting) {
        this.adjacency = from.checkAdjacent(to);
        if(this.adjacency === 0) {
            console.log(from, to);
            throw 'Attempted to construct scaffolding between non-adjacent coordinates'
        }

        this.reasonForExisting = reasonForExisting;
        this.presence = this.reasonForExisting.presence;
        this.fromHarmCoords = from;
        this.toHarmCoords = to;
        [this.fromX, this.fromY, this.fromZ] = from.toUnscaledCoords();
        [this.toX, this.toY, this.toZ] = to.toUnscaledCoords();

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

        this.color.setAlpha(Math.pow(this.presence, 0.8));
        this.thickness = Math.pow(this.presence, 0.9) * (LINE_THICKNESS + 0.2 * HAPPENINGNESS);
    }

    tick() {
        this.presence = this.reasonForExisting.presence;
        this.color.setAlpha(Math.pow(this.presence, 0.8));
        this.thickness = Math.pow(this.presence, 0.9) * (LINE_THICKNESS + 0.2 * HAPPENINGNESS);
        [this.fromX, this.fromY, this.fromZ] = this.fromHarmCoords.toUnscaledCoords();
        [this.toX, this.toY, this.toZ] = this.toHarmCoords.toUnscaledCoords();
    }

    /**
     *
     * @param {Camera} camera
     * @param {p5.Graphics} graphics
     */
    draw(camera, graphics) {
        if (!IS_3D) {
            let [from, to] = [[this.fromX, this.fromY], [this.toX, this.toY]];
            let [fromX, fromY] = camera.toScreenCoordinates(camera.project(from));
            let [toX, toY] = camera.toScreenCoordinates(camera.project(to));
            let fromWidth = camera.projectScalar(this.thickness, from);
            let toWidth = camera.projectScalar(this.thickness, to);
            let [dX, dY] = [toX - fromX, toY - fromY]; // direction vector
            // use direction vector to leave a space so that adjacent lines don't connect
            let fromXSpace = fromX + SCAFFOLDING_SPACE_RATIO * dX;
            let toXSpace = toX - SCAFFOLDING_SPACE_RATIO * dX;
            let fromYSpace = fromY + SCAFFOLDING_SPACE_RATIO * dY;
            let toYSpace = toY - SCAFFOLDING_SPACE_RATIO * dY;
            fromWidth = Math.max(MIN_LINE_THICKNESS_PX, Math.min(MAX_LINE_THICKNESS_PX, fromWidth));
            toWidth = Math.max(MIN_LINE_THICKNESS_PX, Math.min(MAX_LINE_THICKNESS_PX, toWidth));
            graphics.fill(this.color);
            graphics.noStroke();
            Scaffolding.drawVaryingWidthLine(graphics, fromXSpace, fromYSpace, toXSpace, toYSpace, fromWidth, toWidth);
        } else {
            graphics.push();
            let from = createVector(this.fromX, this.fromY, this.fromZ);
            let to = createVector(this.toX, this.toY, this.toZ);
            let dV = to.sub(from); // direction vector

            graphics.translate(from.lerp(to, 0.5)); // draw cylinder at midpoint between from and to
            graphics.applyMatrix(rotateAlign(createVector(0,1,0), dV));
            graphics.ambientMaterial(this.color);
            graphics.cylinder(this.thickness * 5, dV.mag() * (1 - 2 * SCAFFOLDING_SPACE_RATIO));
            graphics.pop();
        }
    }

    static drawVaryingWidthLine(graphics, x1, y1, x2, y2, startWidth, endWidth) {
        const halfStartWidth = startWidth / 2
        const halfEndWidth = endWidth / 2
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const startXOffset = Math.sin(angle) * halfStartWidth;
        const startYOffset = Math.cos(angle) * halfStartWidth;
        const endXOffset = Math.sin(angle) * halfEndWidth;
        const endYOffset = Math.cos(angle) * halfEndWidth;
        graphics.beginShape();
        graphics.vertex(x1 + startXOffset, y1 - startYOffset);
        graphics.vertex(x2 + endXOffset, y2 - endYOffset);
        graphics.vertex(x2 - endXOffset, y2 + endYOffset);
        graphics.vertex(x1 - startXOffset, y1 + startYOffset);
        graphics.endShape(CLOSE);
    }
}

class ScaffoldingManager {
    /** Mapping of from/to coordinates to scaffolding lines
     *
     * @type {Object.<string, Scaffolding>}
     */
    #lines = {};

    /**
     * returns the Scaffolding object from the internal repository of lines
     * @param {HarmonicCoordinates} fromCoord
     * @param {HarmonicCoordinates} toCoord
     * @returns {?Scaffolding}
     */
    #getExistingLine(fromCoord, toCoord) {
        return this.#lines[[fromCoord, toCoord]] || this.#lines[[toCoord, fromCoord]] || null
    }

    #deleteLine(fromCoord, toCoord) {
        delete this.#lines[[fromCoord, toCoord]]
        delete this.#lines[[toCoord, fromCoord]];
    }

    #createLine(fromCoord, toCoord, reasonForExisting) {
        this.#deleteLine(fromCoord, toCoord);
        this.#lines[[fromCoord, toCoord]] = new Scaffolding(fromCoord, toCoord, reasonForExisting);
    }

    /**
     * NOTE: `ScaffoldingManager.tick()` should be called AFTER `BallsManager.tick()`.
     */
    tick() {
        this.#lines = Object.fromEntries(Object.entries(this.#lines).filter(
            ([k,line]) => {
                line.tick();
                return line.presence > 0;
            }
        ));
    }

    /**
     * NOTE: `ScaffoldingManager.draw()` should be called BEFORE `BallsManager.draw()`.
     */
    draw(camera, graphics) {
        for (const [_, line] of Object.entries(this.#lines)) {
            line.draw(camera, graphics);
        }
    }

    /**
     * Create the necessary scaffolding between two balls
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