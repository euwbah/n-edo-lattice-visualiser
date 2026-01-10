import { Color } from 'three';

export const VERSION = 'v0.2.0';
export const DEBUG = true;
export const SHOW_DEBUG_BALLS = true;

export const USE_OCTAVE_REDUCED_PRIMES = true;

/**
 * For 22, 31 edo, `convertStepsToPossibleCoord` converts edostep information to possible ratios.
 *
 * For 12 edo, specify explicit `HarmonicCoordinates` over websocket to override arbitrary JI
 * visualizations. Specify {@linkcode HARMONIC_CONTEXT_METHOD} `= '12ji'`
 *
 * The 12 edo steps can be arbitrary and is merely for the visualizer to remember which notes
 * correspond to which MIDI key, and need not match up with the actual 12 edo key press.
 *
 * @type {12 | 22 | 31}
 */
export const EDO = 31;
document.title = `${EDO} EDO ${EDO == 12 ? 'N' : 11}-limit lattice`;

/**
 * Set to `true` to use MIDI input (12 edo). Otherwise, requires websocket messages to be sent to
 * the server.
 *
 * If receiving signals from Seaboard microtuner, set to `false`.
 */
export const USE_MIDI = false;

/**
 * If `true`, use raycasting to identify which ball is being hovered & clicked. Will display ball's
 * coordinate information. Clicking will copy the coordinate array to clipboard.
 *
 * Use only for demonstration/debugging. Turn this off when performing, extremely laggy.
 */
export const INTERACTIVE = true;

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
 * {@linkcode MIN_FIFTH_HUE} can be greater than {@linkcode MAX_FIFTH_HUE} to reverse the direction
 * of the color wheel.
 */
export const MIN_FIFTH_HUE = 0.75;
/**
 * Ending hue of the color wheel 0-1 (0 is red). The last fifth before A will correspond to this
 * hue.
 *
 * {@linkcode MIN_FIFTH_HUE} can be greater than {@linkcode MAX_FIFTH_HUE} to reverse the direction
 * of the color wheel.
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
 * - cb: critical band roughness 'least discordant' short term memory simulation
 *
 * - l2: least L2 norm distance from true centroid/origin method
 *
 * - l2eo: least L2 norm distance from effective origin method
 *
 * - 12ji: Just intonation with midi key on/off information sent as 12 edo, and explicit
 *         `HarmonicCoordinates` are sent in the websocket messages, no harmonic context
 *         detempering/'upscaling' required. Must set {@linkcode EDO} to 12.
 *
 * - graph: graph-based recursive harmonic context method. Keeps track of note tonicities
 *   ('tonicness') and per-note dissonance contributions. Detemperament candidates are based on
 *   minimum dissonance. However, this doesn't perform that well for low EDOs with lots of tempered
 *   commas, since notes that are very distant from current tonicity (low tonicity) will contribute
 *   low dissonance
 *
 * - graphdist: graph-based method. Same as 'graph' but for selection of detemperament candidates,
 *   prioritizes minimum harmonic distance from anchoring parent pitches. If multiple parent pitches
 *   have the same harmonic distance (e.g. the note G4 has the candidates (3/2 of C4) and (2/3 of
 *   D5)), then prioritizes the parent with higher tonicity.
 *
 * - draw: The first note is set to the first coordinate of {@link DRAW_COORDS}. Then, a pointer is
 *   moved along DRAW_COORDS, which prioritizes the next note to be placed in the harmonic context
 *   over all other options. If none of the detemperament options match the current target in
 *   DRAW_COORDS, 'graphdist' is used.
 *
 *   If a note from DRAW_COORDS is placed, the ball will be marked as permanent. When the permanent
 *   ball reaches 0 presence, it will stay on screen indefinitely.
 *
 *   Use this to make a fixed drawing.
 *
 *
 * @type {'cb' | 'l2' | 'l2eo' | '12ji' | 'graph' | 'graphdist' | 'draw'}
 */
export const HARMONIC_CONTEXT_METHOD = 'graph';

/**
 * When in 'draw' mode, this array contains the coordinates to draw.
 *
 * @type {number[][]}
 */
export const DRAW_COORDS = [
    // 幸 (8 strokes)
    // 1/8 一
    [3, -9, -9, -1],
    [3, -9, -10, -2],
    [0, -8, -12, 0],
    [-3, -7, -14, 2],
    [-3, -7, -13, 3],
    [-3, -7, -12, 4],
    [-2, -7, -11, 4],
    [-2, -5, -11, 4, -1],
    [-2, -5, -11, 3, -1],
    [-2, -5, -11, 2, -1],
    [-2, -6, -12, 2, 0],
    [-2, -6, -11, 3, 0],
    [-2, -6, -11, 4, 0],
    [-2, -7, -11, 4, 1],
    [-2, -7, -12, 3, 1],
    [-2, -7, -12, 2, 1],
    [-2, -8, -13, 2, 2],
    [-2, -8, -12, 3, 2],
    [-2, -8, -11, 4, 2],
    [-3, -7, -11, 5, 2],
    [-3, -7, -12, 4, 2],
    [-3, -7, -13, 3, 2],
    [-3, -5, -13, 3, 1],
    [-3, -5, -12, 4, 1],
    [-3, -5, -11, 5, 1],
    [-3, -3, -11, 5, 0],
    [-3, -3, -12, 4, 0],
    [-3, -3, -13, 3, 0],
    [-3, -1, -13, 3, -1],
    [-3, -1, -12, 4, -1],
    [-3, 2, -11, 5, -3],
    [-3, 0, -9, 6, -1],
    [-3, 0, -10, 5, -1],
    [-3, 1, -11, 4, -2],
    [-3, 0, -13, 3, -1],
    [-3, 1, -12, 4, -1],
    [-2, 0, -13, 3, -1],
    [-3, -1, -10, 4, 0],
    [-3, 1, -10, 4, -1],
    [-3, 3, -12, 4, -2],
    [-3, 3, -10, 4, -2],
    [-3, 2, -9, 5, -1],
    [-3, 3, -7, 6, -2],
    [-2, 2, -8, 5, -2],
    [-1, 1, -8, 4, -2],
    [-1, 0, -7, 5, -1],
    // Transition to 2/8
    [0, 0, -6, 5, -2],
    [1, 0, -5, 6, -2],
    [1, -1, -5, 7, -2],

    // 2/8　十
    [1, -1, -3, 7, -2],
    [1, 2, -1, 7, -4],
    [1, 5, 1, 7, -6],
    [1, 8, 3, 7, -8],
    [1, -2, -5, 6, -1],
    [1, -1, -2, 6, -2],
    [2, -2, 0, 5, -1],
    [1, -2, 0, 6, -1],
    [0, -2, -1, 7, -1],
    [1, -3, -3, 5, -1],
    [1, -4, -2, 5, 0],

    [1, -3, -2, 5, 0],
    [1, -5, -1, 5, 1],
    [0, -5, -1, 6, 1],
    [-1, -5, 0, 7, 1], // up
    [-1, -4, 0, 7, 1],
    [-1, -3, 1, 7, 0],
    [-1, -2, 2, 7, -1], // down

    [-1, 2, 5, 7, -4],
    [-1, 1, 4, 7, -3],
    [-1, 0, 3, 7, -2],

    [-2, -2, 2, 7, -1],
    [-2, -4, 2, 7, 1],
    [-3, -2, 3, 7, -1],
    [-2, -2, 4, 6, -1],
    [-2, -1, 4, 6, -2],
    [-1, -3, 4, 5, -1],
    [-1, -3, 3, 4, -1],

    // transition to 3/8
    [-1, -4, 4, 4, -1],
    [-2, -6, 4, 5, 0],

    // 3/8　土
    [-2, -4, 6, 5, -3],
    [-2, -3, 7, 5, -3],
    [-2, -2, 6, 5, -4],
    [-2, -4, 6, 5, -2],
    [-3, -3, 3, 5, -3],
    [-2, -2, 6, 5, -3],
    [-2, -5, 5, 5, -1],
    [-1, -1, 8, 5, -3],
    [0, -1, 7, 4, -3],
    [-2, -3, 5, 5, -1],
    [-1, 0, 7, 5, -3],
    [0, 0, 7, 4, -3],
    [-1, 1, 7, 5, -3],
    [0, 1, 7, 4, -3],
    [-1, 2, 7, 5, -3],
    [0, 2, 7, 4, -3],
    [-1, 3, 7, 5, -3],
    [-1, 0, 7, 5, -1],
    [0, 3, 7, 4, -3],
    [0, 0, 7, 4, -1],
    [-2, 4, 8, 6, -3],
    [-3, 1, 3, 5, 0],


    // 4/8　草
    [-2, -3, 5, 4, -2],
    [-1, -4, 7, 4, -1],
    [-2, -4, 6, 4, -1],

    // 5/8
    [-1, -5, 5, 4, 1],
    [-1, -6, 5, 4, 2],
    [-1, -5, 6, 4, 1],
    [-1, -4, 7, 4, 0],
    [-1, -5, 7, 4, 1],

    // 6/8　干
    [-2, -6, 7, 4, 0],
    [-2, -7, 7, 4, 1],
    [-3, -4, 5, 4, -1],
    [-2, -5, 7, 4, 0],
    [-3, -3, 5, 4, -1],
    [-1, -4, 8, 4, 0],
    [-3, -4, 5, 4, 0],
    [-2, -5, 4, 3, 1],
    [0, -2, 10, 4, -1],

    // 7/8
    [-2, -2, 8, 3, -3],
    [-2, -4, 9, 4, -1],
    [-2, -1, 8, 3, -3],
    [-2, -3, 9, 4, -1],
    [-2, 0, 8, 3, -3],
    [0, 1, 7, 1, -4],
    [-2, -2, 9, 4, -1],

    // 8/8
    [-1, -2, 10, 4, -2],
    [-1, -2, 8, 3, -2],
    [-2, -2, 9, 4, -2],
    [-2, -2, 7, 3, -2],
    [-3, -2, 7, 3, -2],
    [-2, 0, 6, 1, -4],
    [-4, -2, 7, 3, -2],
    [-3, 0, 6, 1, -4],
    [-5, -2, 7, 3, -2],
    [-8, -2, 4, 3, -2],
    [-12, -2, -1, 2, -2],


    // 恵 (10)

    // 1/10
    [3, 14, -4, 0, -6],
    [3, 18, -2, 0, -9],
    [4, -3, 1, 1, 4],
    [4, -6, 1, 1, 6],
    [4, 3, 6, 2, -1],
    [3, 19, -2, 0, -9],
    [3, 4, 6, 3, -1],

    [7, -6, 5, -1, 4],
    [5, -11, 7, 2, 8],
    [3, -16, 9, 5, 12],

    [3, 9, 9, 4, -4],
    [3, 22, 8, 3, -12],
    [5, 7, 0, 0, 0],

    // transition
    [3, 5, 8, 4, -1],
    [3, 4, 7, 3, -1],
    [2, 6, 3, 3, -1],
    [1, 5, 0, 3, 1],
    // [1, 4, 1, 3, 1],
    [1, 3, 2, 3, 1],
    [1, 2, 3, 3, 1],
    [1, 1, 4, 3, 1],

    // 2/10
    [3, -2, 8, 2, 1],
    [3, -1, 9, 2, 0],
    [3, 4, 6, 0, -3],
    [3, 1, 6, 0, -1],
    [1, -3, 10, 4, 2],
    [3, -8, 7, 1, 5],
    [4, -3, 8, 0, 1],
    [3, -12, 5, 0, 8],

    // 3/10
    [4, -7, 9, 2, 4],
    [2, -8, 7, 3, 6],
    [2, -4, 6, 3, 4],
    [0, 3, 3, 3, 1],
    [2, -5, 6, 3, 5],
    [2, 0, 6, 3, 2],
    [2, -6, 6, 3, 6],
    [2, -8, 8, 4, 7],
    [2, 11, 11, 4, -6],

    // 3.5/10
    [6, -5, 9, 0, 3],
    [5, 2, 7, 0, 0],
    [0, 13, -2, 0, -2],
    [5, -1, 8, 0, 1],
    [2, -1, -1, 0, 6],
    [1, 6, 0, 0, 1],
    [1, 7, 0, 0, 0],
    [2, 4, 2, 0, 1],
    [4, -2, 7, 0, 2],
    [3, -3, 3, -1, 4],

    // 4/10
    [3, 3, 6, 0, -2],
    [3, 1, 5, 0, 0],
    [4, -4, 6, 0, 3],
    [3, 5, 5, 0, -2],
    [3, 7, 5, 0, -3],

    // transition
    [3, 10, 7, 0, -6],
    [2, -1, 4, 0, 2],

    // // 5/10
    [3, 13, 9, 0, -9],
    [2, 1, 7, 1, 0],
    [3, 2, 7, 0, -1],
    [2, 2, 5, 0, 0],
    [2, 4, 5, 0, -1],

    // 6/10

    [7, 0, 5, 0, 1],
    [7, -2, 8, 0, 1],
    [6, 0, 5, 0, 1],
    [6, 1, 6, 0, 0],

    [4, 3, 4, 1, 0],
    [4, 8, 6, 1, -4],
    [3, -2, 2, 1, 4],

    [3, 3, 4, 1, 0],
    [3, 8, 6, 1, -4],
    [2, -2, 2, 1, 4],

    [2, 3, 4, 1, 0],
    [2, 8, 6, 1, -4],

    [1, 3, 4, 1, 0],
    [1, 8, 6, 1, -4],

    // [4, -3, 7, 0, 2],
    [4, 2, 9, 0, -2],

    // 7/10 心

    [-7, 9, -6, 0, -2],

    [-3, 4, 0, 0, -1],
    [-3, 8, 1, 0, -4],

    [-2, 1, 2, 0, 0],
    [-2, 5, 3, 0, -3],
    [2, 1, 5, -2, -2],
    [3, -3, 8, -1, 0],
    [-4, 0, 8, 4, 0],
    [1, -5, 9, 1, 2],

    // 8/10
    [-8, 10, -9, 0, -1],
    [-6, 9, -9, -2, -1],

    [-9, 9, -9, 0, 0],
    [-6, 7, -8, -2, 0],
    [-3, 5, -7, -4, 0],
    [0, 3, -6, -6, 0],
    [3, 1, -5, -8, 0],

    [-4, 4, 0, 0, 0],
    [0, 0, 2, -2, 1],
    [4, -4, 4, -4, 2],
    [-5, 3, 0, 0, 1],
    [-6, 2, 1, 1, 2],
    [6, -2, 4, -6, 0],
    [-6, 1, 1, 1, 3],
    [8, 0, 4, -8, -2],
    [-6, 0, 1, 1, 4],
    [6, -6, 5, -5, 3],
    [5, -5, 4, -5, 3],
    [-10, 6, 6, 7, 2],
    [6, -11, 4, -5, 7],
    [6, 1, 4, -6, -1],
    [6, 13, 4, -7, -9],
    [6, 25, 4, -8, -17],
    [6, 37, 4, -9, -25],
    [6, 49, 4, -10, -33],
    // [-4, 7, -1, 0, 1],
    // [-4, 14, 0, 0, -4],
    // [-9, 14, -12, -2, 1],
    // [-9, 9, -15, -3, 5],
    // [-9, 4, -18, -4, 9],

    // 9/10
    [0, 14, 7, 1, -8],
    [0, 7, -1, -3, -2],
    [3, 12, 7, -2, -8],
    [2, 9, 10, 1, -6],

    // transition
    [-1, 14, 3, 0, -6],
    [-4, 20, -2, 0, -7],
    [-7, 26, -7, 0, -8],
    [-10, 32, -12, 0, -9],

    // 10/10
    [0, 5, 3, 1, 1],
    [2, 6, 5, 0, -1],
    [3, 2, 9, 1, 0],
    [2, 4, 10, 2, -1],
];

/**
 * If true, shows balls at the coordinates specified in {@linkcode DRAW_COORDS} even if they are not
 * yet drawn.
 *
 * @type {boolean}
 */
export const DEBUG_DRAWING = false;

/**
 * The time (in ms) to wait before running {@linkcode updateTonicity} in
 * {@linkcode HarmonicContext.tick}. Only applicable if {@linkcode HARMONIC_CONTEXT_METHOD} is
 * 'graph'.
 */
export const TARGET_TONICITY_UPDATE_TIME = 150;

/**
 * How many origin/root notes to consider when determining candidates for new notes to attach to.
 *
 * The top N notes with highest tonicity will be considered.
 *
 * If this is set too high, it may lag. If set too low, some intended upper structures may not be
 * detected correctly.
 *
 * Only applicable if {@linkcode HARMONIC_CONTEXT_METHOD} is 'graph'.
 */
export const NUM_ROOT_CANDIDATES = 2;

/**
 * If true, octaves of any note (in terms of edo) always replace existing notes in the short term
 * memory. Otherwise, this only happens if the new note has a higher tonicity than the existing note.
 *
 * For the new `graph` and `graphdist` models only.
 */
export const OCTAVES_REPLACE_STM = true;

/**
 * If true, octaves are allowed in the harmonic context.
 */
export const ALLOW_OCTAVES_IN_STM = true;

/**
 * The maximum number of notes that can be held in the harmonic context short term memory.
 */
export const MAX_SHORT_TERM_MEMORY = 8;

/**
 * For each note in the harmonic context, this is the maximum number of times a new, non-octave
 * equivalent note (including tempered octaves, e.g. 125/64 in 12edo) can be added to the
 * {@linkcode HarmonicContext} before the existing note is forgotten by the short term memory. This
 * is a heuristic to prevent old notes from lingering too long.
 *
 * E.g., if we choose 6 (6 new notes after this one), it is a heuristic stating that from the first
 * note in the harmonic context, we can up to 6 different notes before this note must be removed
 * from the harmonic context.
 */
export const MAX_NEW_NOTES_BEFORE_FORGET = 19;

/**
 * The maximum time a note in the HarmonicContext can go without being played (nor sustained by
 * pedal) and still be remembered.
 *
 * Notes that are still held down (not by sustain ped.) will not be forgotten.
 *
 * @see MAX_NEW_NOTES_BEFORE_FORGET
 *
 * @type {number}
 */
export const MAX_DURATION_BEFORE_FORGET_SECS = 100;

/**
 * The maximum time a note in the HarmonicContext can exist in STM without being played, but
 * sustained by pedal.
 *
 * Notes that are still held down (not by sustain ped.) will not be forgotten by virtue of time
 * delay.
 *
 * @type {number}
 */
export const MAX_DURATION_BEFORE_FORGET_SECS_SUSTAINED = 240;

/**
 * This is the maximum permissible dissonance score before the harmonic context tries to delete
 * notes.
 *
 * For the new graph dissonance model, this number should be between 0 and 1.
 */
export const MAX_DISSONANCE = 0.75;

/**
 * If the harmonic context has N notes, the {@linkcode MAX_DISSONANCE} is effectively set to
 * `MAX_DISS_N_NOTES[N]`.
 *
 * If the number of notes in the harmonic context is greater than the length of this array, the
 * default {@linkcode MAX_DISSONANCE} is used.
 *
 * Useful for harmonic context systems with varying expected dissonance scores depending on the
 * number of notes.
 *
 * The currect settings have been fine tuned for graph/graphdist methods. Remember to save before
 * changing.
 *
 * I have set these values to around mean + 2 * stdev of the dissonance score distributions of random
 * chords with N notes.
 */
export const MAX_DISS_N_NOTES = [1, 1, 0.80, 0.7, 0.67, 0.63, 0.6, 0.57, 0.55];

/**
 * below the tolerable dissonance score, there will be no fatigue accumulated When fatigue
 * accumulates, the effective maximum dissonance decreases awaiting a resolution soon.
 *
 * For the new graph dissonance model, this number should be between 0 and 1, although for lesser
 * notes, the dissonance score tends to be higher (e.g. C maj closed triad is 0.5, but C13b5b9 (6
 * notes) is 0.43, and Cmaj#15 is 0.32)
   */
export const CONSONANCE_THRESHOLD = 0.5;

/**
 * `CONSONANCE_THRESH_N_NOTES[N]` will be the effective value of {@linkcode CONSONANCE_THRESHOLD}
 * when the harmonic context has N notes.
 *
 * If the harmonic context has more notes than the length of this array, the default
 * {@linkcode CONSONANCE_THRESHOLD} is used.
 *
 * I have set these values to around mean + 1 * stdev of the dissonance score distributions of random
 * chords with N notes.
 */
export const CONSONANCE_THRESH_N_NOTES = [1, 1, 0.7, 0.65, 0.63, 0.55, 0.53, 0.51, 0.50];

/**
 * After at least this many seconds of dissonance above the MAX_TOLERABLE DISSONANCE threshold, the
   effective maximum dissonance drops down to CONSONANCE_THRESHOLD. The fatigue increases in
   proportion to the current dissonance score. This simulates the fact that when one is exposed to a
   continuous dissonant sound, one will want to resolve it in their minds. */
export const MAX_FATIGUE_SECS = 2.7;

/**
 * If true, the stepsFromA is used to determine whether a Ball is part of the pitch memory e(so
 * multiple sustained balls that are tempered differently will show up as 'chord tones')
 *
 * If false, only the exact harmonic coordinate is used to check, so only one 'chord tone' will show
 * up per pitch memory.
 */
export const CHORD_TONE_TEMPERED = false;

/**
 * Prevents harmonic context from going out of hand by limiting the maximum distance between any two
 * notes in the harmonic context. Octaves count as distance 1.
 *
 * See HarmonicCoordinates.harmonicDistance() for heuristic implementation.
 *
 * For reference, here are some intervals and their harmonic distances.
 *
 * 2/1      1
 * 3/2      2.585
 * 5/3      3.906
 * 5/4      4.063
 * 7/4      4.548
 * 11/8     5.867
 * 21/20    8.455
 * 33/32    8.668
 * 64/63    9.760
 * 81/80    10.158
 * 125/128  10.335
 * */
export const MAX_HARMONIC_DISTANCE = 13.5;
/**
 * If a {@linkcode Ball} is not part of the {@linkcode HarmonicContext}, multiply its saturation by this. */
export const NON_CHORD_TONE_SAT_EFFECT = 0.4;
/**
 * Ball size multiplier applied to notes that are no longer in the harmonic context. */
export const NON_CHORD_TONE_SIZE_EFFECT = 0.4;
/**
 * As long as a note is held, the ball will be at least this size indefinitely.
 */
export const BALL_SUSTAIN_SCALE_FACTOR = 0.04;

/**
 * If no notes were played for this long, and no notes are being sustained, reset the visualizer and
 * delete all context.
 */
export const RESET_TIME_SECS = 5;

/**
 * The minimum duration (in seconds) between changes in effectiveOrigin.
 * @type {number}
 */
export const FASTEST_KEY_CHANGE_SECS = 1.0;

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
 *
 * * relmonzo: Display as a monzo relative to the effectiveOrigin
 * * relfraction: Display as a fraction relative to the effectiveOrigin.
 * * name: Note name, relative to the effectiveOrigin of the Harmonic Context. Removes comma pumps,
 *   but keeps JI intervals unique.
 * * namefraction: Note name initially, but changes to fraction after a certain amount of time.
 * * none: don't display the interval.
 *
 * @type {'relmonzo'|'relfraction'|'name'|'namefraction'|'none'}
 */
export const TEXT_TYPE = 'namefraction';
/**
 * Troika font size to ball size ratio
 * @type {number}
 */
export const TEXT_SIZE = 14;

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
export const MIN_CAM_DIST = 60;
export const MAX_CAM_DIST = 300;
export const CAM_DIST_HAPPENINGNESS = 90;
export const DIST_STD_DEV_RATIO = 0.08; // Affects standard deviation exponential multiplier
export const DIST_STD_DEV_CONST = 1.2; // Constant added to std dev inside exponential multiplier
export const DIST_CHANGE_SPEED = 0.35;

/** If true, use {@link CAMPOS} fixed camera settings. */
export const FIXED_CAM = false;
export const CAMPOS = {
    x: 0,
    y: 0,
    z: 200,
    phi: Math.PI / 2,
    theta: Math.PI / 2,
    dist: 200
}

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
/**
 * Maximum size of a ball.
 */
export const BALL_SIZE = 11;

/**
 * Size of permanent drawing balls in the Instanced Mesh as a multiplier of {@linkcode BALL_SIZE}.
 */
export const DRAW_BALL_SIZE = 0.71;
/**
 * The size of the debug ball that is the target of the centroid particle fountain.
 */
export const HARMONIC_CENTROID_SIZE = 0;
/**
 * The size of the debug ball that denotes where the absolute harmonic coordinate 1/1 is.
 */
export const ORIGIN_SIZE = 0.01;
/**
 * Thickness of the scaffolding line.
 */
export const MAX_LINE_THICKNESS = 1;

/** Minimum thickness of the scaffolding line. */
export const MIN_LINE_THICKNESS = 0.03;

/**
 * A global value between 0-1 representing how happening the music is.
Happeningness diminishes with time and increases with notes.
*/
window.HAPPENINGNESS = 0;
export const NOTE_ON_HAPPENINGNESS = 0.07;
export const HELD_NOTE_HAPPENINGNESS = 0.009;
export const SUSTAINED_NOTE_HAPPENINGNESS = 0.007;

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
 *
 * @type {Object<number, number>}
 */
export const PRIME_OCTAVE_LOOKUP = (() => {
    let x = {};
    for (let i = 0; i < LIST_OF_PRIMES.length; i++) {
        x[LIST_OF_PRIMES[i]] = Math.floor(Math.log2(LIST_OF_PRIMES[i]));
    }
    x[2] = 0; // 2 is the only prime that should not be octave reduced.
    return x;
})();

