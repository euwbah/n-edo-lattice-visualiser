const socket = new WebSocket('ws://127.0.0.1:8765');

const ballManager = new BallsManager();
const scaffoldingManager = new ScaffoldingManager();
const harmonicContext = new HarmonicContext();
const camera = new Camera(harmonicContext);
const harmonicCentroidParticleFountain = new KeyCenterParticleFountain();

socket.onmessage = (e) => {
    // only start reading socket messages when window.essentia is defined
    if (LOADED) {
        let [type, data1, data2] = e.data.split(':');
        data1 = parseInt(data1);
        data2 = parseInt(data2);
        if (type === 'on')
            noteOn(data1, data2, harmonicContext, ballManager, scaffoldingManager);
        else if (type === 'off')
            noteOff(data1, data2);
        else if (type === 'cc')
            cc(data1, data2);
    }
}

function testOn(stepsFromA) {
    noteOn(stepsFromA, 127, harmonicContext, ballManager, scaffoldingManager);
}

function testOff(stepsFromA) {
    noteOff(stepsFromA, 127);
}

socket.onopen = (e) => {
    console.log('web socket connected');
}

/**
 * @type {p5.Graphics}
 */
let GRAPHICS;

let hBlurPass1, vBlurPass2, bloomPass3, blurPass4, blurPass5, bloomPass6;



function setup() {
    let cvs = createCanvas(windowWidth, windowHeight);
    cvs.id('mycanvas');
    colorMode(HSB, 360, 100, 100, 1);
    noStroke();
    GRAPHICS = createGraphics(windowWidth, windowHeight, WEBGL);
    GRAPHICS.colorMode(HSB, 360, 100, 100, 1);
    smooth();
    setAttributes('antialias', true);
    textFont(FIRA_SANS);
    GRAPHICS.textFont(FIRA_SANS);
    GRAPHICS.setAttributes('antialias', true);

    ballManager.setup();

    hBlurPass1 = createGraphics(windowWidth, windowHeight, WEBGL);
    vBlurPass2 = createGraphics(windowWidth, windowHeight, WEBGL);
    bloomPass3 = createGraphics(windowWidth, windowHeight, WEBGL);
    blurPass4 = createGraphics(windowWidth, windowHeight, WEBGL);
    blurPass5 = createGraphics(windowWidth, windowHeight, WEBGL);
    bloomPass6 = createGraphics(windowWidth, windowHeight, WEBGL);
    hBlurPass1.noStroke();
    vBlurPass2.noStroke();
    bloomPass3.noStroke();
    blurPass4.noStroke();
    bloomPass6.noStroke();
}

function windowResized() {
    hBlurPass1.resizeCanvas(windowWidth, windowHeight);
    vBlurPass2.resizeCanvas(windowWidth, windowHeight);
    bloomPass3.resizeCanvas(windowWidth, windowHeight);
    blurPass4.resizeCanvas(windowWidth, windowHeight);
    blurPass5.resizeCanvas(windowWidth, windowHeight);
    bloomPass6.resizeCanvas(windowWidth, windowHeight);
    GRAPHICS.resizeCanvas(windowWidth, windowHeight);
    resizeCanvas(windowWidth, windowHeight);
}

let oldDRotator = 0;

function draw() {
    background(0);
    GRAPHICS.clear();
    if (IS_3D) {
        GRAPHICS.ambientLight(90);
    }

    let [held, sustained] = countExistingKeysState();
    addHappeningness(deltaTime / 4000 * (held * HELD_NOTE_HAPPENINGNESS + sustained * SUSTAINED_NOTE_HAPPENINGNESS));
    HAPPENINGNESS = Math.max(0, HAPPENINGNESS - Math.pow(HAPPENINGNESS * deltaTime / 2000, 1.1));

    let dRotator = (Math.pow(Math.max(0, (HAPPENINGNESS - ROTATOR_START) / (1 - ROTATOR_START)), 2)
        - ROTATOR / (1 + 2 * HAPPENINGNESS * MAX_ROTATION_AMOUNT))
        * deltaTime / 500 * (1 - HAPPENINGNESS) * ROTATOR_SPEED;
    dRotator = dRotator * (1 - ROTATOR_INERTIA) + oldDRotator * ROTATOR_INERTIA;
    ROTATOR += dRotator;
    oldDRotator = dRotator;

    harmonicContext.tick();
    ballManager.tick(KEYS_STATE, harmonicContext);
    scaffoldingManager.tick();
    camera.tick(ballManager.stdDeviation, dRotator, GRAPHICS);
    harmonicCentroidParticleFountain.tick(harmonicContext, dRotator, camera);

    GRAPHICS.push();
    GRAPHICS.noStroke();
    harmonicCentroidParticleFountain.draw(camera, GRAPHICS);
    scaffoldingManager.draw(camera, GRAPHICS);
    ballManager.draw(camera, GRAPHICS);
    GRAPHICS.pop();

    let shaderBlurCoef = SHADER_BLUR_COEF + Math.pow(HAPPENINGNESS, 1.5) * 1.1;
    document.getElementById('mycanvas').style.filter =
        `saturate(${HAPPENINGNESS * 0.7 + 0.75}) brightness(${HAPPENINGNESS * 1.7 + 1}) contrast(${HAPPENINGNESS * 0.5 + 1})`;

    if (USE_SHADERS) {
        hBlurPass1.shader(shaderBlurH);
        shaderBlurH.setUniform('brightness', Math.pow(HAPPENINGNESS, 1.3) * 0.25);
        shaderBlurH.setUniform('tex0', GRAPHICS);
        shaderBlurH.setUniform('texelSize', [1 / windowWidth, 1 / windowHeight]);
        shaderBlurH.setUniform('direction', [shaderBlurCoef, 0]);
        hBlurPass1.rect(0, 0, windowWidth, windowHeight);

        vBlurPass2.shader(shaderBlurV);
        shaderBlurV.setUniform('brightness', Math.pow(HAPPENINGNESS, 1.3) * 0.25);
        shaderBlurV.setUniform('tex0', hBlurPass1);
        shaderBlurV.setUniform('texelSize', [1 / windowWidth, 1 / windowHeight]);
        shaderBlurV.setUniform('direction', [0, shaderBlurCoef]);
        vBlurPass2.rect(0, 0, windowWidth, windowHeight);

        bloomPass3.shader(shaderBloom);
        shaderBloom.setUniform('tex0', GRAPHICS);
        shaderBloom.setUniform('tex1', vBlurPass2);
        shaderBloom.setUniform('bloomAmount', SHADER_BLOOM_AMOUNT);
        bloomPass3.rect(0, 0, windowWidth, windowHeight);

        blurPass4.shader(shaderBlur3);
        shaderBlur3.setUniform('brightness', Math.pow(HAPPENINGNESS, 2) * 0.1);
        shaderBlur3.setUniform('tex0', bloomPass3);
        shaderBlur3.setUniform('texelSize', [1 / windowWidth, 1 / windowHeight]);
        shaderBlur3.setUniform('direction', [shaderBlurCoef, 0]);
        blurPass4.rect(0, 0, windowWidth, windowHeight);

        // blurPass5.shader(shaderBlur4);
        // shaderBlur4.setUniform('brightness', Math.pow(HAPPENINGNESS, 2) * 0.1);
        // shaderBlur4.setUniform('tex0', blurPass4);
        // shaderBlur4.setUniform('texelSize', [1 / windowWidth, 1 / windowHeight]);
        // shaderBlur4.setUniform('direction', [0, shaderBlurCoef]);
        // blurPass5.rect(0, 0, windowWidth, windowHeight);

        // bloomPass6.shader(shaderBloom2);
        // shaderBloom2.setUniform('tex0', bloomPass3);
        // shaderBloom2.setUniform('tex1', blurPass5);
        // shaderBloom2.setUniform('bloomAmount', SHADER_BLOOM_AMOUNT);
        // bloomPass6.rect(0, 0, windowWidth, windowHeight);

        image(blurPass4, 0, 0, windowWidth, windowHeight);
    } else {
        image(GRAPHICS, 0, 0, windowWidth, windowHeight);
    }

    textAlign(LEFT, TOP);
    textSize(20);
    fill(0, 0, 100)
    text(VERSION, 10, 10);
    if (DEBUG) {
        text(`fps: ${(1 / (deltaTime / 1000)).toFixed(1)} `, 60, 10);
        textSize(17);
        if (!IS_3D) {
            text(`camera: ${camera.centerX.toFixed(1)}, ${camera.centerY.toFixed(1)}, ` +
                `zoom: ${camera.zoom.toFixed(1)}, std dev: ${ballManager.stdDeviation.toFixed(2)}`,
                10, 40);
            text(`happening: ${HAPPENINGNESS.toFixed(3)}, diss: ${harmonicContext.dissonance.toFixed(2)} ` +
                `/ ${harmonicContext.effectiveMaxDiss.toFixed(2)} [${harmonicContext.shortTermMemory.length}], ` +
                `rot: ${dRotator.toFixed(5)}`,
                10, 65);
        }
        else {
            text(`center: ${camera.centerX.toFixed(1)}, ${camera.centerY.toFixed(1)}, ${camera.centerZ.toFixed(1)}, ` +
                `dist: ${camera.dist.toFixed(1)}, std dev: ${ballManager.stdDeviation.toFixed(2)}`,
                10, 40);
            text(`happening: ${HAPPENINGNESS.toFixed(3)}, diss: ${harmonicContext.dissonance.toFixed(2)} ` +
                `/ ${harmonicContext.effectiveMaxDiss.toFixed(2)} [${harmonicContext.shortTermMemory.length}], ` +
                `theta: ${camera.theta.toFixed(2)}, phi: ${camera.phi.toFixed(2)}`,
                10, 65);
        }
        text(`harm dist max: ${harmonicContext.maxHarmonicDistance.toFixed(2)}, ` +
            `mean: ${harmonicContext.meanHarmonicDistance.toFixed(2)}`,
            10, 90);
        text(`balls: ${ballManager.numBalls}, part: ${harmonicCentroidParticleFountain.numParticles}`, 10, 120)
        textSize(23);
        text(`${harmonicContext.effectiveOrigin.toMonzoString()}`, 10, 150);
    }
}

let _generateRandom = null;

function startRandom() {
    let r = 0;
    _generateRandom = setInterval(() => {
        r += Math.floor(Math.random() * 30) - 15;
        testOn(r);
        let offNote = r;
        setTimeout(() => {
            testOff(offNote);
        }, 1000)
    }, 100);
}

function stopRandom() {
    clearInterval(_generateRandom);
}