const socket = new WebSocket('ws://127.0.0.1:8765');

const ballManager = new BallsManager();
const scaffoldingManager = new ScaffoldingManager();
const harmonicContext = new HarmonicContext();
const camera = new Camera(harmonicContext);

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
    createCanvas(windowWidth, windowHeight);
    colorMode(HSB, 360, 100, 100, 1);
    noStroke();
    GRAPHICS = createGraphics(windowWidth, windowHeight);
    GRAPHICS.colorMode(HSB, 360, 100, 100, 1);
    smooth();
    setAttributes('antialias', true);
    textFont(FIRA_SANS);

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

let resizeGraphicsTimeout = null;
function windowResized() {
    if (resizeGraphicsTimeout != null)
        clearTimeout(resizeGraphicsTimeout);

    resizeCanvas(windowWidth, windowHeight);
    resizeGraphicsTimeout = setTimeout(() => {
        GRAPHICS = createGraphics(windowWidth, windowHeight, WEBGL);
        hBlurPass1 = createGraphics(windowWidth, windowHeight, WEBGL);
        vBlurPass2 = createGraphics(windowWidth, windowHeight, WEBGL);
        bloomPass3 = createGraphics(windowWidth, windowHeight, WEBGL);
        blurPass4 = createGraphics(windowWidth, windowHeight, WEBGL);
        blurPass5 = createGraphics(windowWidth, windowHeight, WEBGL);
        bloomPass6 = createGraphics(windowWidth, windowHeight, WEBGL);
        resizeGraphicsTimeout = null;
    }, 500);
}

function draw() {
    background(0);
    GRAPHICS.background(0);

    ballManager.tick(KEYS_STATE, harmonicContext);
    scaffoldingManager.tick();
    camera.tick(ballManager.stdDeviation);

    scaffoldingManager.draw(camera, GRAPHICS);
    ballManager.draw(camera, GRAPHICS);

    if (USE_SHADERS) {
        hBlurPass1.shader(shaderBlurH);
        shaderBlurH.setUniform('tex0', GRAPHICS);
        shaderBlurH.setUniform('texelSize', [1 / windowWidth, 1 / windowHeight]);
        shaderBlurH.setUniform('direction', [SHADER_BLUR_COEF, 0]);
        hBlurPass1.rect(0, 0, windowWidth, windowHeight);

        vBlurPass2.shader(shaderBlurV);
        shaderBlurV.setUniform('tex0', hBlurPass1);
        shaderBlurV.setUniform('texelSize', [1 / windowWidth, 1 / windowHeight]);
        shaderBlurV.setUniform('direction', [0, SHADER_BLUR_COEF]);
        vBlurPass2.rect(0, 0, windowWidth, windowHeight);

        bloomPass3.shader(shaderBloom);
        shaderBloom.setUniform('tex0', GRAPHICS);
        shaderBloom.setUniform('tex1', vBlurPass2);
        shaderBloom.setUniform('bloomAmount', SHADER_BLOOM_AMOUNT);
        bloomPass3.rect(0, 0, windowWidth, windowHeight);

        blurPass4.shader(shaderBlur3);
        shaderBlur3.setUniform('tex0', bloomPass3);
        shaderBlur3.setUniform('texelSize', [1 / windowWidth, 1 / windowHeight]);
        shaderBlur3.setUniform('direction', [SHADER_BLUR_COEF, 0]);
        blurPass4.rect(0, 0, windowWidth, windowHeight);

        blurPass5.shader(shaderBlur4);
        shaderBlur4.setUniform('tex0', blurPass4);
        shaderBlur4.setUniform('texelSize', [1 / windowWidth, 1 / windowHeight]);
        shaderBlur4.setUniform('direction', [0, SHADER_BLUR_COEF]);
        blurPass5.rect(0, 0, windowWidth, windowHeight);

        bloomPass6.shader(shaderBloom2);
        shaderBloom2.setUniform('tex0', bloomPass3);
        shaderBloom2.setUniform('tex1', blurPass5);
        shaderBloom2.setUniform('bloomAmount', SHADER_BLOOM_AMOUNT);
        bloomPass6.rect(0, 0, windowWidth, windowHeight);

        image(blurPass4, 0, 0, windowWidth, windowHeight);
    } else {
        image(GRAPHICS, 0, 0, windowWidth, windowHeight);
    }

    textSize(20);
    fill(0, 0, 100)
    text(`fps: ${(1 / (deltaTime / 1000)).toFixed(1)}` +
        ` camera: ${camera.centerX.toFixed(1)}, ${camera.centerY.toFixed(1)}, ` +
        `zoom: ${camera.zoom.toFixed(1)}, ball std dev: ${ballManager.stdDeviation}`,
        10, 30);
    text('v0.1', 10, 60);
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