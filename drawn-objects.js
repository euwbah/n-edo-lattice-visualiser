const DIESES_TO_FIFTHS_MAP = (() => {
    let x = {};
    let d = 0;
    for (let fifths = 0; fifths < 31; fifths++) {
        x[d] = fifths;
        d = (d + 18) % 31;
    }
    return x;
})();

/**
 * Algorithm:
 * Harmonic Coordinates -> Unscaled coordinates -> Scaled coordinates -> Projection
 */
class Camera {
    targetCenterX = 0;
    targetCenterY = 0;
    centerX = 0;
    centerY = 0;
    #harmonicContext;
    zoom = MAX_ZOOM;
    zoomTarget = MAX_ZOOM;

    constructor(harmonicContext) {
        this.#harmonicContext = harmonicContext;
    }

    tick(stdDeviation) {
        [this.targetCenterX, this.targetCenterY] = this.#harmonicContext.tonalCenterUnscaledCoords;
        let dt = deltaTime > 1000 ? 1000 : deltaTime;
        this.centerX += (this.targetCenterX - this.centerX) * dt / 1000;
        this.centerY += (this.targetCenterY - this.centerY) * dt / 1000;
        let scaledDeviation = (stdDeviation - MAX_ZOOM_STD_DEV) / (MIN_ZOOM_STD_DEV - MAX_ZOOM_STD_DEV);
        scaledDeviation = Math.max(0, Math.min(1, scaledDeviation));
        this.zoomTarget = MIN_ZOOM + (MAX_ZOOM - MIN_ZOOM) * (1 - scaledDeviation);
        this.zoom += (this.zoomTarget - this.zoom) * dt / 1000;
    }

    // Project unscaled coordinates into cartesian coordinates from origin.
    project(unscaledCoordinates) {
        let [x, y] = unscaledCoordinates;
        x = (x - this.centerX) * this.zoom;
        y = (y - this.centerY) * this.zoom;

        if (PROJECTION_TYPE === 'curved') {
            x = Math.pow(Math.abs(x), EXPONENT) * Math.sign(x);
            y = Math.pow(Math.abs(y), EXPONENT) * Math.sign(y);
        }

        return [x, y];
    }

    projectScalar(scalar, unscaledCoordinates) {
        // method: multiply the scalar by the average of d(project(x))/d(x) and d(project(y))/d(y)
        // d(p(x))/dx = zoom ^ exp * abs(x) ^ (EXP - 1)
        // defined for all x except x = 0
        // if x = 0, use dx = zoom.
        let [x, y] = unscaledCoordinates;
        let dx = this.zoom, dy = this.zoom;
        let zoomConst = Math.pow(this.zoom, EXPONENT);
        if (x !== 0)
            dx = zoomConst * Math.pow(Math.abs(x), EXPONENT - 1);

        if (y !== 0)
            dy = zoomConst * Math.pow(Math.abs(y), EXPONENT - 1);

        if (dx > this.zoom)
            dx = this.zoom;
        if (dy > this.zoom)
            dy = this.zoom;

        return scalar * (dx + dy) / 2;
    }

    toScreenCoordinates(cartesian) {
        return [cartesian[0] + windowWidth/2, windowHeight/2 - cartesian[1]];
    }
}

class Ball {
    harmCoords;
    presence; // Number from 0-1
    stepsFromA;
    x;
    y;
    hue;
    saturation;
    color;
    sizeUnscaled;
    isChordTone = true;

    constructor(harmCoords, stepsFromA, presence) {
        // Note: this is in Hue Saturation Brightness format
        this.harmCoords = harmCoords;
        this.presence = presence;
        this.stepsFromA = stepsFromA;
        [this.x, this.y] = this.harmCoords.toUnscaledCoords();
        let dieses = mod(stepsFromA, 31);
        let octaves = Math.floor(stepsFromA / 31) + 4;
        this.hue = 330 * DIESES_TO_FIFTHS_MAP[dieses] / 31 + 15;
        this.saturation = 95 - 25 * (octaves - 2) / 5 // Let saturation start to fall at octave 2
        this.color = color(this.hue, this.saturation, 100 * Math.pow(presence, 0.5), 0.9);
        this.sizeUnscaled = Math.pow(presence, 0.5) * BALL_SIZE;
    }

    tick(keyState, harmonicContext) {
        this.isChordTone = harmonicContext.containsNote(this.stepsFromA);
        if (this.stepsFromA in keyState) {
            if (this.isChordTone) {
                if (this.presence > 0.4)
                    this.presence = this.presence * (1 - 0.5 * deltaTime / 1000);
                else if (this.presence < 0.4)
                    this.presence = 0.4;
            } else {
                if (this.presence > 0.3)
                    this.presence = this.presence * (1 - 0.75 * deltaTime / 1000);
                else if (this.presence < 0.3)
                    this.presence = 0.3;
            }
        } else {
            if (this.isChordTone) {
                this.presence = this.presence * (1 - deltaTime / 1000) - 0.4 * deltaTime / 1000;
            } else {
                this.presence = this.presence * (1 - 3 * deltaTime / 1000) - 1 * deltaTime / 1000;
            }
        }

        let chordToneMult = this.isChordTone ? 1 : CHORD_TONE_EFFECT;

        this.color = color(this.hue, this.saturation * chordToneMult, 100 * Math.pow(this.presence, 0.5));
        this.sizeUnscaled = Math.pow(this.presence, 0.5) * BALL_SIZE;
    }

    /**
     *
     * @param {Camera} camera
     * @param {p5.Graphics} graphics
     */
    draw(camera, graphics) {
        let unscaledCoords = [this.x, this.y];
        let [x, y] = camera.toScreenCoordinates(camera.project(unscaledCoords));
        let size = camera.projectScalar(this.sizeUnscaled * (this.isChordTone ? 1 : CHORD_TONE_EFFECT), unscaledCoords);
        graphics.noStroke();
        graphics.fill(this.color);
        graphics.circle(x, y, size);
    }
}

class BallsManager {
    /**
     * @type {Object.<HarmonicCoordinates, Ball>}
     */
    balls = {};
    /**
     * The mean of the standard deviation of the x and y coordinates of the balls.
     */
    #stddev = 0;

    /**
     *
     * @param {HarmonicCoordinates} harmCoords
     * @param {number} stepsFromA
     * @param {number} velocity
     * @returns {Ball} The ball that was created
     */
    noteOn(harmCoords, stepsFromA, velocity) {
        console.log('ball note on: ', harmCoords);
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
        let xValues = [], yValues = [];
        this.balls = Object.fromEntries(Object.entries(this.balls).filter(
            ([k,ball]) => {
                ball.tick(keyState, harmonicContext);
                xValues.push(ball.x);
                yValues.push(ball.y);
                return ball.presence > 0;
            }
        ));
        if (xValues.length !== 0)
            this.#stddev = (math.std(xValues) + math.std(yValues)) / 2;

    }

    /**
     *
     * @param {Camera} camera
     * @param {p5.Graphics} graphics buffer to draw to
     */
    draw(camera, graphics) {
        for (const [_, ball] of Object.entries(this.balls)) {
            ball.draw(camera, graphics);
        }
    }

    get stdDeviation() {
        return this.#stddev;
    }
}

class Scaffolding {
    reasonForExisting; // Contains the most recent Ball object which requires the existence of this line.
    fromX;
    fromY;
    toX;
    toY;
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
        [this.fromX, this.fromY] = from.toUnscaledCoords();
        [this.toX, this.toY] = to.toUnscaledCoords();

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
        this.thickness = Math.pow(this.presence, 0.9) * LINE_THICKNESS;
    }

    tick() {
        this.presence = this.reasonForExisting.presence;
        this.color.setAlpha(Math.pow(this.presence, 0.8));
        this.thickness = Math.pow(this.presence, 0.9) * LINE_THICKNESS;
    }

    /**
     *
     * @param {Camera} camera
     * @param {p5.Graphics} graphics
     */
    draw(camera, graphics) {
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