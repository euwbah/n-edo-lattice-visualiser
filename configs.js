const VERSION = 'v0.1.7'
let DEBUG = true;
let SHOW_DEBUG_BALLS = true;

const USE_OCTAVE_REDUCED_PRIMES = true;

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

// Set range of hues of the color wheel (in degrees) to assign
// to the notes according to the circle of fifths.
let MIN_FIFTH_HUE = 15;
let MAX_FIFTH_HUE = 345;

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


let MAX_SHORT_TERM_MEMORY = 7;
let MAX_DISSONANCE = 23;

/**
 * Maximum number of times a completely new note appears in the HarmonicContext
 * before an existing old note is forgotten by the short term memory.
 * The constant chosen (6) is a heuristic stating that up to 7 notes
 * can be contextualised as the 'tonal center', and any more than that
 * will require an older note to be forgotten or recontextualised.
 * Note that the counter disregards octaves of existing notes,
 * so in that sense, this rule is still more permissive than the
 * main `MAX_SHORT_TERM_MEMORY` rule.
 * This just prevents old notes from lingering around too long.
 */
let MAX_NEW_NOTES_BEFORE_FORGET = 6;

/**
 * The maximum time a note in the HarmonicContext can go without being
 * played and still be remembered.
 *
 * In the same spirit as `MAX_NEW_NOTES_BEFORE_FORGET`
 * @type {number}
 */
let MAX_DURATION_BEFORE_FORGET_SECS = 12;

/**
 * below the tolerable dissonance score, there will be no fatigue accumulated
When fatigue accumulates, the effective maximum dissonance decreases
awaiting a resolution soon.*/
let CONSONANCE_THRESHOLD = 12;

/**
 * After at least this many seconds of dissonance above the MAX_TOLERABLE DISSONANCE
threshold, the effective maximum dissonance drops down to CONSONANCE_THRESHOLD.
The fatigue increases in proportion to the current dissonance score.
This simulates the fact that when one is exposed to a continuous
dissonant sound, one will want to resolve it in their minds.*/
let MAX_FATIGUE_SECS = 0.6;

/**
 * Prevents harmonic context from going out of hand
See HarmonicCoordinates.harmonicDistance() for heuristic implementation.*/
let MAX_HARMONIC_DISTANCE = 13;
/**
 * How much does being a (non)chord-tone affect the display of a ball.
the closer the value to zero, the higher the effect.*/
let CHORD_TONE_EFFECT = 0.7;

let RESET_TIME_SECS = 1;

/**
 * The minimum duration (in seconds) between changes in effectiveOrigin.
 * @type {number}
 */
let FASTEST_KEY_CHANGE_SECS = 1.5;

/**
 * Sets effectiveOrigin such that the highest power of 2 permissible in the denominator
 * of the relative ratios of all the notes in the key center is as such.
 * @type {number}
 */
let HIGHEST_REL_P2_DENOM = 4;

/**
 * Sets effectiveOrigin such that the highest power of 3 permissible in the denominator
 * of the relative ratios of all the notes in the key center is as such.
 * @type {number}
 */
let HIGHEST_REL_P3_DENOM = 1;

/**
 * Display the interval of the notes on the balls.
 * relmonzo: Display as a monzo relative to the effectiveOrigin
 * relfraction: Display as a fraction relative to the effectiveOrigin.
 * none: don't display the interval.
 * @type {'relmonzo'|'relfraction'|'none'}
 */
let TEXT_TYPE = 'relfraction';
/**
 * Set the minimum size of the ball text display.
 * @type {number}
 */
let MIN_TEXT_SIZE_PX = 14;
let MAX_TEXT_SIZE_PX = 25;

/**
 * @type {'exp2d'|'exppolar'}
 */
let PROJECTION_TYPE = 'exppolar';
let MAX_ZOOM = 65;
let MIN_ZOOM = 12;
let MAX_ZOOM_STD_DEV = 1;
let MIN_ZOOM_STD_DEV = 20;
/**
 * When in 'exp2d' projection mode, x and y coordinates will be set to the
 * power of this exponent.
 *
 * When in 'exppolar' projection mode, the radial coordinates of the polar system will be
 * set to the power of this exponent.
 * @type {number}
 */
let EXPONENT = 0.7;
/** How much the exponent can grow proportional to happeningness*/
let EXPONENT_GROWTH = 0.999 - EXPONENT;
/** How fast the zoom can change */
let ZOOM_CHANGE_SPEED = 0.9;
/** How much zoom can shrink (as a ratio of overall zoom) proportional to happeningness*/
let ZOOM_SHRINK = 0.4;
/** 1 is the average speed*/
let CAM_SPEED = 0.6;
/** Maximum additional cam speed depending on current happeningness*/
let CAM_SPEED_HAPPENINGNESS = 3.8;

/**
 * The HAPPENINGNESS value where the projection starts rotating.
 * @type {number}
 */
let ROTATOR_START = 0.15;
let MAX_ROTATION_AMOUNT = 10;
let ROTATOR_SPEED = 1.2; // Changing the rotator speed also scales the max rotation amount.
/**
 * The fraction of the current rotator speed that is present from the previous rotator speed
 * rot speed = inertia * old speed + (1 - inertia) * new speed
 * @type {number}
 */
let ROTATOR_INERTIA = 0.3;

// Rotational lag happens when the ROTATOR is changing
// and the current camera position is far from the absolute origin,
// the angular velocity of the rotator causes a huge velocity of
// the projected items on the screen, for which the camera cannot
// keep up with.

/**
 * Sets the fraction of rotational lag for the camera
0 means 100% compensation for rotation-induced velocity. (the harmonic centroid will always appear to be the absolute origin)
1 means zero compensation for rotation-induced velocity*/
let CAM_ROTATIONAL_LAG_COEF = 0.2;
let CAM_MAX_ROTATIONAL_LAG_X_PX = 50;
let CAM_MAX_ROTATIONAL_LAG_Y_PX = 40;

// Sets rotation lag coefficients for Harmonic Context key center
let HARMONIC_CENTER_ROTATIONAL_LAG_COEF = 0.3;
let HARMONIC_CENTER_MAX_ROTATIONAL_LAG_X_PX = 70;
let HARMONIC_CENTER_MAX_ROTATIONAL_LAG_Y_PX = 70;

let HARMONIC_CENTER_SPEED = 1.5;
let HARMONIC_CENTER_SPEED_HAPPENINGNESS = 2.9;

// Particles are spawned with initial velocity that can
// combat absolute velocity caused by rotation.
let PARTICLE_ROTATIONAL_LAG_COEF = 0.35;
let PARTICLE_MIN_SPEED = 0.1;
let PARTICLE_MAX_SPEED = 0.5;

let PARTICLE_LIFE_SECS = 3;
let PARTICLE_MIN_SIZE = 0.1;
let PARTICLE_MAX_SIZE = 0.3;
let PARTICLE_MAX_CHANCE = 0.75;
let PARTICLE_MIN_CHANCE = 0.1;

let BALL_SIZE = 1.45;
let LINE_THICKNESS = 0.2;
let MIN_LINE_THICKNESS_PX = 2;
let MAX_LINE_THICKNESS_PX = 10;

let USE_SHADERS = true;
let SHADER_BLUR_COEF = 0.2;
let SHADER_BLOOM_AMOUNT = 40;

/**
 * A global value between 0-1 representing how happening the music is.
Happeningness diminishes with time and increases with notes.*/
let HAPPENINGNESS = 0;
let NOTE_ON_HAPPENINGNESS = 0.15;
let HELD_NOTE_HAPPENINGNESS = 0.04;
let SUSTAINED_NOTE_HAPPENINGNESS = 0.01;

function addHappeningness(amt) {
    HAPPENINGNESS = Math.max(0, Math.min(1, HAPPENINGNESS + amt));
}