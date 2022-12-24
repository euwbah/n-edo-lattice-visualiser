import { Color } from 'three';

export const VERSION = 'v0.1.7';
export const DEBUG = true;
export const SHOW_DEBUG_BALLS = true;

export const USE_OCTAVE_REDUCED_PRIMES = true;

/**
 * Now supports 22 and 31 edo.
 */
export const EDO = 22;
document.title = `${EDO} EDO 11-limit lattice`;

export const SCAFFOLDING_SPACE_RATIO = 0.05;

// Set range of hues of the color wheel (in degrees) to assign
// to the notes according to the circle of fifths.
export const MIN_FIFTH_HUE = 0;
export const MAX_FIFTH_HUE = 1;

export const OCTAVES_COLOR = new Color('hsl(210, 7%, 60%)');
export const FIFTHS_COLOR = new Color('hsl(40, 60%, 65%)');
export const THIRDS_COLOR = new Color('hsl(140, 70%, 42%)');
export const SEPTIMAL_COLOR = new Color('hsl(210, 60%, 50%)');
export const UNDECIMAL_COLOR = new Color('hsl(25, 100%, 60%)');

/**
 * cb: critical band roughness 'least discordant' short term memory simulation method
 * l2: least L2 norm distance from true centroid/origin method
 * l2eo: least L2 norm distance from effective origin method
 * @type {'cb' | 'l2'}
 */
export const HARMONIC_CONTEXT_METHOD = 'l2';

export const MAX_SHORT_TERM_MEMORY = 7;
export const MAX_DISSONANCE = 23;

/**
 * Maximum number of times a compexport constely new note appears in the HarmonicContext
 * before an existing old note is forgotten by the short term memory.
 * The constant chosen (6) is a heuristic stating that up to 7 notes
 * can be contextualised as the 'tonal center', and any more than that
 * will require an older note to be forgotten or recontextualised.
 * Note that the counter disregards octaves of existing notes,
 * so in that sense, this rule is still more permissive than the
 * main `MAX_SHORT_TERM_MEMORY` rule.
 * This just prevents old notes from lingering around too long.
 */
export const MAX_NEW_NOTES_BEFORE_FORGET = 6;

/**
 * The maximum time a note in the HarmonicContext can go without being
 * played and still be remembered.
 *
 * In the same spirit as `MAX_NEW_NOTES_BEFORE_FORGET`
 * @type {number}
 */
export const MAX_DURATION_BEFORE_FORGET_SECS = 12;

/**
 * below the tolerable dissonance score, there will be no fatigue accumulated
When fatigue accumulates, the effective maximum dissonance decreases
awaiting a resolution soon.*/
export const CONSONANCE_THRESHOLD = 12;

/**
 * After at least this many seconds of dissonance above the MAX_TOLERABLE DISSONANCE
threshold, the effective maximum dissonance drops down to CONSONANCE_THRESHOLD.
The fatigue increases in proportion to the current dissonance score.
This simulates the fact that when one is exposed to a continuous
dissonant sound, one will want to resolve it in their minds.*/
export const MAX_FATIGUE_SECS = 0.6;

/**
 * Prevents harmonic context from going out of hand
See HarmonicCoordinates.harmonicDistance() for heuristic implementation.*/
export const MAX_HARMONIC_DISTANCE = 30;
/**
 * How much does being a non-chord-tone affect the saturation of a ball.
the closer the value to zero, the higher the effect. */
export const NON_CHORD_TONE_SAT_EFFECT = 0.6;
/**
 * How much does being a non-chord-tone affect the size of a ball. */
export const NON_CHORD_TONE_SIZE_EFFECT = 0.75;
/**
 * When a key is held, the ball will be at least this size.
 */
export const BALL_SUSTAIN_SCALE_FACTOR = 0.04;

export const RESET_TIME_SECS = 2;

/**
 * The minimum duration (in seconds) between changes in effectiveOrigin.
 * @type {number}
 */
export const FASTEST_KEY_CHANGE_SECS = 1.5;

/**
 * Sets effectiveOrigin such that the highest power of 2 permissible in the denominator
 * of the relative ratios of all the notes in the key center is as such.
 * @type {number}
 */
export const HIGHEST_REL_P2_DENOM = 4;

/**
 * Sets effectiveOrigin such that the highest power of 3 permissible in the denominator
 * of the relative ratios of all the notes in the key center is as such.
 * @type {number}
 */
export const HIGHEST_REL_P3_DENOM = 1;

/**
 * Display the interval of the notes on the balls.
 * relmonzo: Display as a monzo relative to the effectiveOrigin
 * relfraction: Display as a fraction relative to the effectiveOrigin.
 * none: don't display the interval.
 * @type {'relmonzo'|'relfraction'|'none'}
 */
export const TEXT_TYPE = 'relfraction';
/**
 * Troika font size to ball size ratio
 * @type {number}
 */
export const TEXT_SIZE = 8;

/**
 * @type {'3d'}
 */
export const PROJECTION_TYPE = '3d';

/**
 * Camera config for 3D
 * 
 * In 3D, zoom settings are based on standard deviation of ball positions
 * affecting distance of camera from the centroid.
 */
export const CAM_SPEED = 0.6;
export const CAM_SPEED_HAPPENINGNESS = 3.8;
export const CAM_ROT_SPEED = 1.5;
export const MAX_CAM_ROT_SPEED = 1.57;
export const CAM_ROT_ACCEL = 0.01;
export const MIN_CAM_DIST = 70;
export const MAX_CAM_DIST = 900;
export const CAM_DIST_HAPPENINGNESS = 110;
export const DIST_STD_DEV_RATIO = 2.5; // Each unit std dev will yield add this much cam distance
export const DIST_CHANGE_SPEED = 0.4;

/**
 * How much jitter (in vector magnitude) to add when happeningness is maximum.
 */
export const JITTER_HAPPENINGNESS = 0.9;

/** 
 * Speed of particle system
 */
export const HARMONIC_CENTER_SPEED = 0.4;
export const HARMONIC_CENTER_SPEED_HAPPENINGNESS = 0.5;

export const PARTICLE_LIFE_SECS = 3;
export const PARTICLE_MIN_SIZE = 0.1;
export const PARTICLE_MAX_SIZE = 0.3;
export const PARTICLE_MAX_CHANCE = 0.75;
export const PARTICLE_MIN_CHANCE = 0.1;
export const MAX_PARTICLES = 100;

export const MAX_BALLS = 100;
export const BALL_SIZE = 9;
export const HARMONIC_CENTROID_SIZE = 0;
export const ORIGIN_SIZE = 0.01;
export const LINE_THICKNESS = 1;

/**
 * A global value between 0-1 representing how happening the music is.
Happeningness diminishes with time and increases with notes.
*/
window.HAPPENINGNESS = 0;
export const NOTE_ON_HAPPENINGNESS = 0.1;
export const HELD_NOTE_HAPPENINGNESS = 0.04;
export const SUSTAINED_NOTE_HAPPENINGNESS = 0.01;

export function addHappeningness(amt) {
    HAPPENINGNESS = Math.max(0, Math.min(1, HAPPENINGNESS + amt));
}