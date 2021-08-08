const VERSION = 'v0.1.2'

// TODO: Work these constants out
let P2_angle = 90;
let P2_len = 4;
let P3_angle = 0;
let P3_len = 6;
let P5_angle = 30;
let P5_len = 5;
let P7_angle = 20;
let P7_len = 8;
let P11_angle = 40;
let P11_len = 7;

let SCAFFOLDING_SPACE_RATIO = 0.05;

let FIRA_SANS;
let shaderBlurH, shaderBlurV, shaderBloom, shaderBlur3, shaderBlur4, shaderBloom2;

let OCTAVES_COLOR;
let FIFTHS_COLOR;
let THIRDS_COLOR;
let SEPTIMAL_COLOR;
let UNDECIMAL_COLOR;

function preload() {
    FIRA_SANS = loadFont('FiraSansExtralight-AyaD.ttf');

    shaderBlurH = loadShader('base.vert', 'blur.frag');
    shaderBlurV = loadShader('base.vert', 'blur.frag');
    shaderBloom = loadShader('base.vert', 'bloom.frag');
    shaderBlur3 = loadShader('base.vert', 'blur.frag');
    shaderBlur4 = loadShader('base.vert', 'blur.frag');
    shaderBloom2 = loadShader('base.vert', 'bloom.frag');
    colorMode(HSB, 360, 100, 100, 1);
    OCTAVES_COLOR = color(210, 10, 60);
    FIFTHS_COLOR = color(40, 60, 60);
    THIRDS_COLOR = color(140, 70, 60);
    SEPTIMAL_COLOR = color(210, 80, 70);
    UNDECIMAL_COLOR = color(25, 100, 80);
}


let MAX_SHORT_TERM_MEMORY = 6;
let MAX_DISSONANCE = 20;
// Prevents harmonic context from going out of hand
// See HarmonicCoordinates.harmonicDistance() for heuristic implementation.
let MAX_HARMONIC_DISTANCE = 8;
// How much does being a (non)chord-tone affect the display of a ball.
// the closer the value to zero, the higher the effect.
let CHORD_TONE_EFFECT = 0.7;

let PROJECTION_TYPE = 'curved';
let MAX_ZOOM = 100;
let MIN_ZOOM = 45;
let MAX_ZOOM_STD_DEV = 1;
let MIN_ZOOM_STD_DEV = 9;
let EXPONENT = 0.85;

let BALL_SIZE = 1.45;
let LINE_THICKNESS = 0.2;
let MIN_LINE_THICKNESS_PX = 2;
let MAX_LINE_THICKNESS_PX = 10;

let USE_SHADERS = true;
let SHADER_BLUR_COEF = 0.5;
let SHADER_BLOOM_AMOUNT = 0.6;