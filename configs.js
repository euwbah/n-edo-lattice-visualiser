import { Color } from 'three';

export const VERSION = 'v0.1.7';
export const DEBUG = true;
export const SHOW_DEBUG_BALLS = true;

export const USE_OCTAVE_REDUCED_PRIMES = true;

/**
 * For 22, 31 edo, `convertStepsToPossibleCoord` converts edostep information to possible ratios.
 *
 * For 12 edo, specify explicit `HarmonicCoordinates` over websocket to override arbitrary JI visualizations.
 * Specify {@linkcode HARMONIC_CONTEXT_METHOD} `= '12ji'`
 *
 * The 12 edo steps can be arbitrary and is merely for the visualizer to remember which notes correspond to which
 * MIDI key, and need not match up with the actual 12 edo key press.
 *
 * @type {12 | 22 | 31}
 */
export const EDO = 12;
document.title = `${EDO} EDO ${EDO == 12 ? 'N' : 11}-limit lattice`;

/**
 * Hardcoded list of primes. Each prime number corresponds to one axis of the lattice.
 */
export const LIST_OF_PRIMES = [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
    101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199,
    211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293,
    307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397,
    401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499,
    503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599,
    601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691,
    701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797,
    809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887,
    907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997,
    1009, 1013, 1019, 1021, 1031, 1033, 1039, 1049, 1051, 1061, 1063, 1069, 1087, 1091, 1093, 1097,
    1103, 1109, 1117, 1123, 1129, 1151, 1153, 1163, 1171, 1181, 1187, 1193,
    1201, 1213, 1217, 1223, 1229, 1231, 1237, 1249, 1259, 1277, 1279, 1283, 1289, 1291, 1297,
    1301, 1303, 1307, 1319, 1321, 1327, 1361, 1367, 1373, 1381, 1399,
    1409, 1423, 1427, 1429, 1433, 1439, 1447, 1451, 1453, 1459, 1471, 1481, 1483, 1487, 1489, 1493, 1499,
    1511, 1523, 1531, 1543, 1549, 1553, 1559, 1567, 1571, 1579, 1583, 1597, 1601, 1607, 1609, 1613, 1619,
    1621, 1627, 1637, 1657, 1663, 1667, 1669, 1693, 1697, 1699,
    1709, 1721, 1723, 1733, 1741, 1747, 1753, 1759, 1777, 1783, 1787, 1789,
    1801, 1811, 1823, 1831, 1847, 1861, 1867, 1871, 1873, 1877, 1879, 1889,
    1901, 1907, 1913, 1931, 1933, 1949, 1951, 1973, 1979, 1987, 1993, 1997, 1999,
    2003, 2011, 2017, 2027, 2029, 2039, 2053, 2063, 2069, 2081, 2083, 2087, 2089, 2099,
    2111, 2113, 2129, 2131, 2137, 2141, 2143, 2153, 2161, 2179,
    2203, 2207, 2213, 2221, 2237, 2239, 2243, 2251, 2267, 2269, 2273, 2281, 2287, 2293, 2297,
    2309, 2311, 2333, 2339, 2341, 2347, 2351, 2357, 2371, 2377, 2381, 2383, 2389, 2393, 2399,
    2411, 2417, 2423, 2437, 2441, 2447, 2459, 2467, 2473, 2477,
    2503, 2521, 2531, 2539, 2543, 2549, 2551, 2557, 2579, 2591, 2593,
    2609, 2617, 2621, 2633, 2647, 2657, 2659, 2663, 2671, 2677, 2683, 2687, 2689, 2693, 2699,
    2707, 2711, 2713, 2719, 2729, 2731, 2741, 2749, 2753, 2767, 2777, 2789, 2791, 2797, 2801,
    2803, 2819, 2833, 2837, 2843, 2851, 2857, 2861, 2879, 2887, 2897
];

export const SCAFFOLDING_SPACE_RATIO = 0.05;

// Set range of hues of the color wheel (from 0 to 1) to assign
// to the notes according to the circle of fifths.

/**
 * Starting hue of the color wheel 0-1 (0 is red). The tuning note A will correspond to this hue.
 *
 * {@linkcode MIN_FIFTH_HUE} can be greater than {@linkcode MAX_FIFTH_HUE} to reverse the direction of the color wheel.
 */
export const MIN_FIFTH_HUE = 0.75;
/**
 * Ending hue of the color wheel 0-1 (0 is red). The last fifth before A will correspond to this hue.
 *
 * {@linkcode MIN_FIFTH_HUE} can be greater than {@linkcode MAX_FIFTH_HUE} to reverse the direction of the color wheel.
 */
export const MAX_FIFTH_HUE = 0.28;

export const OCTAVES_COLOR = new Color('hsl(210, 7%, 60%)');
export const FIFTHS_COLOR = new Color('hsl(40, 60%, 65%)');
export const THIRDS_COLOR = new Color('hsl(140, 70%, 42%)');
export const SEPTIMAL_COLOR = new Color('hsl(210, 60%, 50%)');
export const UNDECIMAL_COLOR = new Color('hsl(25, 100%, 60%)');

/**
 * Contains mapping of colors for each unit JI axis.
 *
 * @type {Object<number, Color>}
 */
export const JI_COLORS = (() => {
    let colors = {
        2: OCTAVES_COLOR,
        3: FIFTHS_COLOR,
        5: THIRDS_COLOR,
        7: SEPTIMAL_COLOR,
        11: UNDECIMAL_COLOR
    };

    for (let i = 5; i < LIST_OF_PRIMES.length; i++) {
        let prime = LIST_OF_PRIMES[i];
        let hue = 67 * i % 360; // 67 yields a spread distribution of colors
        let sat = 100 - 17 * i % 50;
        let val = 40 + 13 * i % 20;
        colors[LIST_OF_PRIMES[i]] = new Color(`hsl(${hue}, ${sat}%, ${val}%)`);
    }

    return colors;
})();

/**
 * - cb: critical band roughness 'least discordant' short term memory simulation method
 * - l2: least L2 norm distance from true centroid/origin method
 * - l2eo: least L2 norm distance from effective origin method
 * - 12ji: Just intonation with midi key on/off information sent as 12 edo, and explicit `HarmonicCoordinates` are
 *         sent in the websocket messages, no harmonic context detempering/'upscaling' required. Must set {@linkcode EDO}
 *         to 12.
 *
 * @type {'cb' | 'l2' | 'l2eo' | '12ji'}
 */
export const HARMONIC_CONTEXT_METHOD = '12ji';

export const MAX_SHORT_TERM_MEMORY = 9;
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
 * played (nor sustained by pedal) and still be remembered.
 *
 * Notes that are still held down (not by sustain ped.) will not be forgotten
 * by virtue of time delay.
 *
 * In the same spirit as `MAX_NEW_NOTES_BEFORE_FORGET`
 *
 * @type {number}
 */
export const MAX_DURATION_BEFORE_FORGET_SECS = 8;

/**
 * The maximum time a note in the HarmonicContext can exist in STM
 * without being played, but sustained by pedal.
 *
 * Notes that are still held down (not by sustain ped.) will not be forgotten
 * by virtue of time delay.
 *
 * @type {number}
 */
export const MAX_DURATION_BEFORE_FORGET_SECS_SUSTAINED = 15;

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
export const MAX_HARMONIC_DISTANCE = 70;
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

export const RESET_TIME_SECS = 3;

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
 * Set to `true` to run in sculpture mode.
 *
 * In sculpture mode, the ./recording.json file is read and rendered into an
 * animated sculpture of the entire playback of the song.
 *
 * NOTE:
 */
export const SCULPTURE_MODE = false;
export const SCULPTURE_PX_DENSITY = 2;
export const SCULPTURE_BALL_SIZE = 10;
/**
 * How long each animation cycle is in seconds.
 */
export const SCULPTURE_CYCLE_DURATION = 60;
export const SCULPTURE_CAM_DIST = 500;
/**
 * How many cycles to rotate camera back to starting position.
 */
export const SCULPTURE_CAM_THETA_CYCLES = 3;
export const SCULPTURE_CAM_PHI_CYCLES = 2;
/**
 * The fraction of lastBallTimeOn to delay each cycle by. (Add more delay to make a 'swoosh' effect)
 */
export const SCULPTURE_CYCLE_DELAY = 1.6;

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
export const MIN_CAM_DIST = 30;
export const MAX_CAM_DIST = 420;
export const CAM_DIST_HAPPENINGNESS = 110;
export const DIST_STD_DEV_RATIO = 7.0; // Each unit std dev will yield add this much cam distance
export const DIST_CHANGE_SPEED = 0.4;

/**==
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

/**
 * Lookup index of a prime number in the list of primes.
 *
 * @type {Object<number, number>}
 */
export const PRIME_LOOKUP = (() => {
    let x = {};
    for (let i = 0; i < LIST_OF_PRIMES.length; i++) {
        x[LIST_OF_PRIMES[i]] = i;
    }
    return x;
})();
/**
 * Lookup of the octave offset of a prime number. (E.g. 3 => 1, 5 => 2, 7 => 2, 11 => 3).
 * Makes octave reduction calculation faster.
 */
export const PRIME_OCTAVE_LOOKUP = (() => {
    let x = {};
    for (let i = 0; i < LIST_OF_PRIMES.length; i++) {
        x[LIST_OF_PRIMES[i]] = Math.floor(Math.log2(LIST_OF_PRIMES[i]));
    }
    x[2] = 0; // 2 is the only prime that should not be octave reduced.
    return x;
})();

