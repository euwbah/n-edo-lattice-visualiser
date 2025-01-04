import { PRIME_LOOKUP, PRIME_OCTAVE_LOOKUP, LIST_OF_PRIMES, EDO, USE_OCTAVE_REDUCED_PRIMES } from './configs.js';
import { mod } from './helpers.js';

function primeFactors(n) {
    const factors = {};
    let divisor = 2;

    if (!Number.isInteger(n)) {
        return factors;
    }

    while (n >= 2) {
        if (n % divisor === 0) {
            if (!(divisor in factors)) {
                factors[divisor] = 0;
            }
            factors[divisor] += 1;
            n = n / divisor;
        } else {
            divisor++;
        }
    }
    return factors;
}

/**
 * Adjusts distance scale globally.
 *
 * @type {number}
 */
const DIST_SCALE_FACTOR_3D = 20;

/**
 * Each successive prime's unit vector has phi rotated by this amount.
 * (phi is the angle between the Y-axis and the XZ plane).
 *
 * Rotation is taken modulo 1 * pi (backwards rotations are handled by theta).
 *
 * This should be an irrational number that don't have similar nearby values when multiples of it are taken modulo pi.
 *
 * See https://www.desmos.com/calculator/ciawfuzaoy for a visualization of the rotations of the first N unit vectors
 * for why these constants are chosen.
 */
const PHI_OFFSET = 10 * Math.PI * 2 * Math.SQRT2 / 2 / Math.sqrt(382) / 1.89999;

/**
 * Each successive prime's unit vector has theta rotated by this amount.
 * (theta is the angle starting from the X-axis toward the direction of the Z-axis)
 *
 * Rotation is taken modulo 2 * pi.
 *
 * This should be an irrational number that don't have similar values when multiples of it are taken modulo 2*pi.
 *
 * See https://www.desmos.com/calculator/ciawfuzaoy for a visualization of the rotations of the first N unit vectors
 * for why these constants are chosen.
 */
const THETA_OFFSET = 10 * Math.PI * 2 * Math.SQRT2 / 1.89999;

/**
 * The unit vector distance of each prime. Uses a squashed logarithmic scale with prime 2 as the unit length 1.
 *
 * @param {number} prime
 * @returns
 */
function primeDistanceFunction(prime) {
    return Math.log10(prime) - (Math.log10(2) - 1);
}

/**
 * Unit vectors of all the primes, in the same order as {@linkcode LIST_OF_PRIMES}.
 *
 * Each element is a 3-element array `[x, y, z]`.
 *
 *  @type {number[][]}
 */
const PRIME_UNIT_VECTORS = (() => {
    let vecs = [
        // Swap these two when playing many octaves so that octaves can fit on the screen.
        [0, primeDistanceFunction(2), 0], // Octave should point upward.
        [primeDistanceFunction(3), 0, 0], // Fifths should point right.
    ];

    for (let idx in PRIME_LOOKUP) {
        if (idx == 0 || idx == 1)
            continue;

        let prime = LIST_OF_PRIMES[idx];
        let i = idx - 1; // start from one multiple of the offset.

        let r = primeDistanceFunction(prime);

        let phi = (Math.PI - PHI_OFFSET * i) % Math.PI;
        let theta = (THETA_OFFSET * i - 0.5 * Math.PI) % (Math.PI * 2);

        // spherical coords ()
        let x = r * Math.sin(phi) * Math.cos(theta);
        let y = r * Math.cos(phi);
        let z = r * Math.sin(phi) * Math.sin(theta);

        vecs.push([x, y, z]);
    }

    return vecs;
})();

export class HarmonicCoordinates {
    /**
     * N-dimensional coords array. Each element is the power of a prime, starting from 2, then 3,
     * etc...
     *
     * if {@linkcode USE_OCTAVE_REDUCED_PRIMES} is true, all non-octave primes are octave reduced.
     * E.g., the second element corresponds to powers of (3/2) third element corresponds to powers
     * of (5/4) etc...
     *
     * This value must be immutable. Do not write directly to this value anywhere else except in the
     * constructor.
     *
     * @type {number[]}
     */
    _coords;

    /**
     * Memoized ratio of this coordinate. Lazily evaluated when {@linkcode toRatio} is called.
     *
     * `[numerator, denominator]`
     */
    #ratio = null;

    /**
     * Memoized absolute power of 2. Lazily evaluated when {@linkcode p2absolute} is called, or
     * initialized in constructor if {@linkcode USE_OCTAVE_REDUCED_PRIMES} is `false` making it
     * trivial.
     *
     * @type {number}
     */
    #p2absolute = null;

    /**
     * Memoized {@link edosteps} of this coordinate. Lazily evaluated when getter {@linkcode edosteps} is accessed.
     * @type {number}
     */
    #edosteps

    /**
     * @param {number[]} coords List of powers of primes starting from 2, 3, 5. If
     * {@linkcode USE_OCTAVE_REDUCED_PRIMES} is `true`, make sure that the first element is the
     * octave reduced power of 2, not the absolute one.
     *
     * @param {number?} p2absolute If we already calculated the absolute octave offset, pass it so
     * that we don't have to recalculate {@linkcode HarmonicCoordinates.p2absolute}. Only applicable
     * if {@linkcode USE_OCTAVE_REDUCED_PRIMES} is `true`.
     */
    constructor(coords, p2absolute = null) {
        if (coords instanceof HarmonicCoordinates) {
            coords = coords.coords;
        }
        coords = coords.slice() || [0]; // copy to prevent mutation of original array (is this worth the performance hit?)
        while (coords.length >= 1 && coords[coords.length - 1] == 0) {
            // remove trailing zeroes, so that the array length of any two equal HarmonicCoordinates
            // are equal.
            coords.pop()
        }
        if (coords.length != 0) {
            this._coords = Object.freeze(coords);
        }
        else {
            this._coords = Object.freeze([0]);
        }
        this.#p2absolute = p2absolute;

        if (!USE_OCTAVE_REDUCED_PRIMES) {
            this.#p2absolute = this._coords[0];
        }
    }

    /**
     * Construct a new {@linkcode HarmonicCoordinates} object from JSON.
     *
     * @param {number[]} json Serialized {@linkcode HarmonicCoordinates} (coords array).
     */
    static fromJSON(json) {
        return new HarmonicCoordinates(json);
    }

    /**
     * The serialized JSON object of a {@linkcode HarmonicCoordinates} object is just the
     * {@linkcode coords} array.
     * @returns {number[]}
     */
    toJSON() {
        return this._coords;
    }

    get primeLimit() {
        return LIST_OF_PRIMES[this._coords.length - 1];
    }

    /**
     * N-dimensional coords array. Each element is the power of a prime, starting from 2, then 3,
     * etc...
     *
     * if {@linkcode USE_OCTAVE_REDUCED_PRIMES} is true, all non-octave primes are octave reduced.
     * E.g., the second element corresponds to powers of (3/2) third element corresponds to powers
     * of (5/4) etc...
     * @type {number[]}
     */
    get coords() {
        return this._coords;
    }

    set coords(_) {
        throw new Error("HarmonicCoordinates: coords is immutable.");
    }

    /**
     * Helper property for getting the power of the first prime (2, octaves).
     */
    get p2() {
        return this._coords[0];
    }

    /**
     * Helper property for getting power of the second prime (3, or 3/2 if
     * {@linkcode USE_OCTAVE_REDUCED_PRIMES})
     */
    get p3() {
        return this._coords[1] ?? 0;
    }

    /**
     * Absolute power of 2. Will be equal to first element of {@linkcode coords} if
     * {@linkcode USE_OCTAVE_REDUCED_PRIMES} is `false`.
     *
     * Otherwise, this value contains the absolute unreduced power of 2, as {@linkcode coords}
     * assume octave reduced primes.
     *
     * E.g. when octave reduction is active, [0, 1] correspond to 3/2, so `p2absolute` will be `-1`
     * as 1/2 = 2^-1.
     *
     * This value is lazily evaluated if {@linkcode USE_OCTAVE_REDUCED_PRIMES} is `true` and a
     * precomputed `p2absolute` value was not passed in the constructor.
     */
    get p2absolute() {
        if (this.#p2absolute !== null)
            return this.#p2absolute;

        this.#p2absolute = this.coords[0];

        if (USE_OCTAVE_REDUCED_PRIMES) {
            for (let i = 1; i < this.coords.length; i++) {
                this.#p2absolute -= PRIME_OCTAVE_LOOKUP[LIST_OF_PRIMES[i]] * this.coords[i];
            }
        }

        return this.#p2absolute;
    }

    /**
     * The number of edosteps this coordinate is from 1/1.
     * @returns {number}
     */
    get edosteps() {
        if (this.#edosteps !== undefined)
            return this.#edosteps;

        this.#edosteps = this.toP2AbsoluteArray().reduce((acc, numPrimeIntervals, primeIdx) => acc + numPrimeIntervals * VALS[EDO][primeIdx], 0);
        return this.#edosteps;
    }

    /**
     *
     * @param {this|[number]} hc
     * @returns {this}
     */
    add(hc) {
        let coords = (hc instanceof Array) ? hc : hc.coords;
        let newCoords = [];
        let maxLength = Math.max(this.coords.length, coords.length);
        for (let i = 0; i < maxLength; i++) {
            let x = 0;
            if (i < this.coords.length)
                x += this.coords[i];
            if (i < coords.length)
                x += coords[i];
            newCoords.push(x);
        }
        return new this.constructor(newCoords);
    }

    /**
     *
     * @param {this|[number]} hc
     * @returns {this}
     */
    subtract(hc) {
        let coords = (hc instanceof Array) ? hc : hc.coords;
        let newCoords = [];
        let maxLength = Math.max(this.coords.length, coords.length);
        for (let i = 0; i < maxLength; i++) {
            let x = 0;
            if (i < this.coords.length)
                x += this.coords[i];
            if (i < coords.length)
                x -= coords[i];
            newCoords.push(x);
        }
        return new this.constructor(newCoords);
    }

    /**
     * Returns a new {@linkcode HarmonicCoordinates} (or child class) with every coordinate element
     * rounded to the nearest integer.
     *
     * Useful for quantizing an 'average' harmonic coordinate to a valid point in the lattice.
     *
     * @return {this}
     */
    round() {
        return new this.constructor(this.coords.map(x => Math.round(x)));
    }

    /**
     * @param {number} numerator
     * @param {number} denominator
     * @returns {this}
     */
    static fromRatio(numerator, denominator) {
        let numFacs = primeFactors(numerator);
        let denFacs = primeFactors(denominator);
        let primeUnion = numFacs; // union of prime factors of numerator and denominator
        for (let denPrime in denFacs) {
            if (denPrime in primeUnion) {
                primeUnion[denPrime] -= denFacs[denPrime];
            } else {
                primeUnion[denPrime] = -denFacs[denPrime];
            }
        }

        let coords = [0];

        // when octave reduced primes are used, compensate octave offset of each prime so that prime intervals are
        // octave reduced:
        // e.g. 3/2: [-1, 1] becomes [0, 1]
        //      5/4: [-2, 0, 1] becomes [0, 0, 1]
        let octOffset = 0;

        for (let prime in primeUnion) {
            let power = primeUnion[prime];
            coords[PRIME_LOOKUP[prime]] = power;

            octOffset += PRIME_OCTAVE_LOOKUP[prime] * power;
        }

        for (let i = 0; i < coords.length; i++) {
            if (coords[i] === undefined)
                coords[i] = 0;
        }

        let p2abs = coords[0];
        if (USE_OCTAVE_REDUCED_PRIMES) {
            coords[0] += octOffset;
            // NOTE: There was a bug here where coords was kept empty (the fraction was 1/1), and
            // because of that, coords[0] is undefined, resulting in [NaN] being passed as coords.
            // This was fixed only in v0.2.0
        }

        return new this(coords, p2abs);
    }

    /**
     *
     * @returns {[number, number]} [numerator, denominator]
     */
    toRatio() {
        if (this.#ratio !== null)
            return this.#ratio;

        let num = 1, den = 1;

        if (this.p2absolute > 0) {
            num *= 2 ** this.p2absolute;
        } else if (this.p2absolute < 0) {
            den *= 2 ** (-this.p2absolute);
        }

        for (let i = 1; i < this.coords.length; i++) {
            if (this.coords[i] > 0)
                num *= LIST_OF_PRIMES[i] ** this.coords[i];
            else if (this.coords[i] < 0)
                den *= LIST_OF_PRIMES[i] ** (-this.coords[i]);
        }

        this.#ratio = [num, den];
        return this.#ratio;
    }

    toRatioString() {
        let [num, den] = this.toRatio();
        return `${num}/${den}`;
    }

    toUnscaledCoords() {
        let coords = [0, 0, 0];
        for (let i = 0; i < this.coords.length; i++) {
            coords = coords.map((x, j) => x + this.coords[i] * PRIME_UNIT_VECTORS[i][j]);
        }
        return [
            DIST_SCALE_FACTOR_3D * coords[0],
            DIST_SCALE_FACTOR_3D * coords[1],
            DIST_SCALE_FACTOR_3D * coords[2],
        ];
    }

    /**
     * Returns the frequency of this relative ratio, respective to the given `fundamental`.
     *
     * @param {number} fundamental Fundamental frequency of 1/1
     * @returns
     */
    toFrequency(fundamental) {
        this.coords.forEach((pow, idx) => {
            if (pow != 0 && idx != 0)
                fundamental *= LIST_OF_PRIMES[idx] ** pow
        });

        fundamental *= 2 ** this.p2absolute;

        return fundamental;
    }

    /**
     * @returns {number} The relative frequency multiplier of this interval relative to 1/1.
     */
    toMultiplier() {
        return this.toFrequency(1);
    }

    /**
     * Monzos always assume non-octave reduced primes.
     * @returns {string}
     */
    toMonzoString() {
        return `[ ${this.toP2AbsoluteArray().join(" ")} >`;
    }

    toString() {
        return this.coords.toString();
    }

    /**
     * DEPRECATED. Use {@linkcode coords} instead
     * @returns
     */
    toArray() {
        return this.coords;
    }

    /**
     * Same as {@linkcode coords} but assuming no octave reduced primes. Helpful for calculations.
     *
     * This value will be the same as {@linkcode coords} if {@linkcode USE_OCTAVE_REDUCED_PRIMES} is
     * `false`.
     */
    toP2AbsoluteArray() {
        return [this.p2absolute, ...this.coords.slice(1)];
    }

    /**
     * Check if this coordinate can be directly connected
     * to another coordinate in the lattice.
     * @param hc
     * @returns {number} 0 if not adjacent, otherwise, a positive/negative number equivalent to the
     *                   prime number that the two coordinates differ by.
     *                   E.g. if returns -5, that means that `hc` is a major third below `this`.
     */
    checkAdjacent(hc) {
        let diff = hc.subtract(this);
        let diffArr = diff.coords;

        if (diffArr.some(x => Math.abs(x) > 1))
            return 0;

        let prime = 0;
        for (let i = 0; i < diffArr.length; i++) {
            let x = diffArr[i];
            if (x === 1 || x === -1) {

                if (prime !== 0)
                    return 0; // only allow one prime to be different.

                prime = LIST_OF_PRIMES[i];

                prime *= x; // invert number if negative.
            }
        }

        if (prime !== 0)
            return prime;
        else
            return 0;
    }

    /**
     * A heuristic measure to evaluate the distance/norm between two {@linkcode HarmonicCoordinates} / {@linkcode NoteName}
     *
     * This value is always positive.
     * @param other {this}
     *
     * @see {@linkcode harmonicDistanceFromOrigin}
     */
    harmonicDistance(other) {
        return other.subtract(this).harmonicDistanceFromOrigin();
    }

    /**
     * The heuristic distance of this coordinate from the origin 1/1.
     *
     * This value is always based on non-reduced primes.
     *
     * @returns {number}
     */
    harmonicDistanceFromOrigin() {
        let hDist = 0;
        // TODO: Adjust harmonic distance formula.
        this.toP2AbsoluteArray().forEach((pow, idx) =>
            hDist += Math.pow(Math.abs(pow), 0.8) * Math.log2(LIST_OF_PRIMES[idx]));
        return hDist;

    }

    equals(hc) {
        if (this.coords.length != hc.coords.length)
            return false;

        return this.coords.every((x, i) => x == hc.coords[i]);
    }

    /**
     * Assumes that this coordinate uses octave reduced primes (3/2, 5/4, 7/4, ...), even when
     * {@linkcode USE_OCTAVE_REDUCED_PRIMES} is `false`.
     *
     * Then, converts the octave reduced primes to absolute primes (3/1, 5/1, 7/1, ...).
     *
     * @returns {this}
     */
    convOctReducedToAbs() {
        let coords = this.coords.slice();

        if (USE_OCTAVE_REDUCED_PRIMES) {
            return new HarmonicCoordinates(this.toP2AbsoluteArray());
        }

        for (let i = 1; i < coords.length; i++) {
            coords[0] -= PRIME_OCTAVE_LOOKUP[LIST_OF_PRIMES[i]] * coords[i];
        }
        return new this.constructor(coords);
    }
}

function arrayOfHarmonicCoordinates(fractions) {
    let x = [];
    for (let [a, b] of fractions)
        x.push(HarmonicCoordinates.fromRatio(a, b));

    return x;
}

/**
 * @type {Object.<number, HarmonicCoordinates[]>}
 */
const RATIOS31 = {
    // do
    0: [HarmonicCoordinates.fromRatio(1, 1)],
    1: arrayOfHarmonicCoordinates([
        [45, 44],
        [49, 48],
        [128, 125],
        [36, 35]
    ]),
    2: arrayOfHarmonicCoordinates([
        [25, 24], [21, 20], [22, 21]
    ]),
    3: arrayOfHarmonicCoordinates([
        [16, 15] //, [15,14]
    ]),
    4: arrayOfHarmonicCoordinates([
        [12, 11], [11, 10]//, [35, 32]
    ]),
    // re
    5: arrayOfHarmonicCoordinates([
        [9, 8], [10, 9]//, [28,25]
    ]),
    6: arrayOfHarmonicCoordinates([
        [8, 7]//, [144,125]
    ]),
    7: arrayOfHarmonicCoordinates([
        [7, 6]//, [75,64]
    ]),
    8: arrayOfHarmonicCoordinates([
        [6, 5]//, [25,21]
    ]),
    9: arrayOfHarmonicCoordinates([
        [11, 9]//, [27,22], [60, 49], [49, 40]
    ]),
    // mi
    10: arrayOfHarmonicCoordinates([
        [5, 4]
    ]),
    11: arrayOfHarmonicCoordinates([
        [9, 7], [14, 11], [32, 25]
    ]),
    12: arrayOfHarmonicCoordinates([
        [21, 16]//, [125,96]
    ]),
    // fa
    13: arrayOfHarmonicCoordinates([
        [4, 3]
    ]),
    14: arrayOfHarmonicCoordinates([
        [11, 8], [15, 11]
    ]),
    15: arrayOfHarmonicCoordinates([
        [7, 5], [45, 32], [25, 18]
    ]),
    16: arrayOfHarmonicCoordinates([
        [10, 7], [64, 45], [36, 25]
    ]),
    17: arrayOfHarmonicCoordinates([
        [16, 11]//, [22,15]
    ]),
    // so
    18: arrayOfHarmonicCoordinates([
        [3, 2]
    ]),
    19: arrayOfHarmonicCoordinates([
        [32, 21]//, [192,125]
    ]),
    20: arrayOfHarmonicCoordinates([
        [14, 9], [11, 7], [25, 16]
    ]),
    21: arrayOfHarmonicCoordinates([
        [8, 5]
    ]),
    22: arrayOfHarmonicCoordinates([
        [18, 11], [44, 27]//, [49,30], [80,49]
    ]),
    // la
    23: arrayOfHarmonicCoordinates([
        [5, 3]//, [42,25]
    ]),
    24: arrayOfHarmonicCoordinates([
        [12, 7]//, [128,75]
    ]),
    25: arrayOfHarmonicCoordinates([
        [7, 4]//, [125,72]
    ]),
    26: arrayOfHarmonicCoordinates([
        [16, 9], [9, 5]//, [25,14]
    ]),
    27: arrayOfHarmonicCoordinates([
        [11, 6]//, [20,11], [64,35]
    ]),
    // ti
    28: arrayOfHarmonicCoordinates([
        [15, 8]
    ]),
    29: arrayOfHarmonicCoordinates([
        [48, 25], [40, 21], [21, 11]
    ]),
    30: arrayOfHarmonicCoordinates([
        [88, 45], [96, 49],
        //[125,64],
        [35, 18]
    ])
};

/**
 * @type {Object.<number, HarmonicCoordinates[]>}
 */
const RATIOS22 = {
    // do
    0: arrayOfHarmonicCoordinates([
        [1, 1]
    ]),
    1: arrayOfHarmonicCoordinates([
        [36, 35], [33, 32]
    ]),
    2: arrayOfHarmonicCoordinates([
        [16, 15], [15, 14]
    ]),
    3: arrayOfHarmonicCoordinates([
        [12, 11], [11, 10], [10, 9]
    ]),
    // Re
    4: arrayOfHarmonicCoordinates([
        [9, 8], [8, 7]
    ]),
    5: arrayOfHarmonicCoordinates([
        [7, 6]
    ]),
    6: arrayOfHarmonicCoordinates([
        [6, 5], [11, 9]
    ]),
    7: arrayOfHarmonicCoordinates([
        [5, 4], //[96, 77]
    ]),
    // Mi
    8: arrayOfHarmonicCoordinates([
        [14, 11], [9, 7]
    ]),
    // Fa
    9: arrayOfHarmonicCoordinates([
        [4, 3]
    ]),
    10: arrayOfHarmonicCoordinates([
        [11, 8], [15, 11]
    ]),
    11: arrayOfHarmonicCoordinates([
        [7, 5], [10, 7], [45, 32]
    ]),
    12: arrayOfHarmonicCoordinates([
        [16, 11], [22, 15]
    ]),
    // So
    13: arrayOfHarmonicCoordinates([
        [3, 2]
    ]),
    14: arrayOfHarmonicCoordinates([
        [14, 9], [11, 7]
    ]),
    15: arrayOfHarmonicCoordinates([
        [8, 5], //[77, 48]
    ]),
    16: arrayOfHarmonicCoordinates([
        [5, 3], [18, 11]
    ]),
    // La
    17: arrayOfHarmonicCoordinates([
        [12, 7]
    ]),
    18: arrayOfHarmonicCoordinates([
        [7, 4], [16, 9]
    ]),
    19: arrayOfHarmonicCoordinates([
        [9, 5], [11, 6], [20, 11]
    ]),
    20: arrayOfHarmonicCoordinates([
        [28, 15], [15, 8]
    ]),
    // Ti
    21: arrayOfHarmonicCoordinates([
        [64, 33], [35, 18]
    ]),
};

/**
 * @type {Object.<number, HarmonicCoordinates[]>}
 */
const RATIOS12_11LIM = {
    0: arrayOfHarmonicCoordinates([
        [1, 1]
    ]),
    1: arrayOfHarmonicCoordinates([
        [16, 15], [15, 14], [135, 128], [2187, 2048], [256, 243]
    ]),
    2: arrayOfHarmonicCoordinates([
        [9, 8], [10, 9], [8, 7]
    ]),
    3: arrayOfHarmonicCoordinates([
        [6, 5], [7, 6], [32, 27]
    ]),
    4: arrayOfHarmonicCoordinates([
        [5, 4], [9, 7], [81, 64]
    ]),
    5: arrayOfHarmonicCoordinates([
        [4, 3]
    ]),
    6: arrayOfHarmonicCoordinates([
        [45, 32], [64, 45], [729, 512], [1024, 729], [7, 5], [10, 7], [11, 8], [16, 11]
    ]),
    7: arrayOfHarmonicCoordinates([
        [3, 2]
    ]),
    8: arrayOfHarmonicCoordinates([
        [8, 5], [128, 81], [25, 16], [14, 9]
    ]),
    9: arrayOfHarmonicCoordinates([
        [5, 3], [27, 16], [12, 7]
    ]),
    10: arrayOfHarmonicCoordinates([
        [16, 9], [9, 5], [7, 4]
    ]),
    11: arrayOfHarmonicCoordinates([
        [15, 8], [243, 128], [28, 15], [256, 135], [486, 256]
    ]),
}

/**
 * @type {Object.<number, HarmonicCoordinates[]>}
 */
const RATIOS12 = {
    0: arrayOfHarmonicCoordinates([
        [1, 1]
    ]),
    1: arrayOfHarmonicCoordinates([
        [16, 15], [135, 128], [2187, 2048], [256, 243]
    ]),
    2: arrayOfHarmonicCoordinates([
        [9, 8], [10, 9]
    ]),
    3: arrayOfHarmonicCoordinates([
        [6, 5], [32, 27]
    ]),
    4: arrayOfHarmonicCoordinates([
        [5, 4], [81, 64]
    ]),
    5: arrayOfHarmonicCoordinates([
        [4, 3]
    ]),
    6: arrayOfHarmonicCoordinates([
        [45, 32], [64, 45], [729, 512], [1024, 729]
    ]),
    7: arrayOfHarmonicCoordinates([
        [3, 2]
    ]),
    8: arrayOfHarmonicCoordinates([
        [8, 5], [128, 81], [25, 16]
    ]),
    9: arrayOfHarmonicCoordinates([
        [5, 3], [27, 16]
    ]),
    10: arrayOfHarmonicCoordinates([
        [16, 9], [9, 5],
    ]),
    11: arrayOfHarmonicCoordinates([
        [15, 8], [243, 128], [256, 135], [486, 256]
    ]),
}

/**
 * Convert edosteps into a list of plausible HarmonicCoordinates.
 *
 * @param {Number} edosteps
 * @returns {HarmonicCoordinates[]} An array of {@linkcode HarmonicCoordinates} representing possible coordinates this edostep maps to.
 */
export function convertStepsToPossibleCoord(steps) {
    let octaves = math.floor(steps / EDO);
    let edosteps = mod(steps, EDO);
    // the .add function causes this function to return an entirely new copy of HarmonicCoordinates
    // objects so it is now ok to modify the returned coordinates from this function.
    if (EDO == 31)
        return RATIOS31[edosteps].map(x => x.add([octaves]));
    else if (EDO == 22)
        return RATIOS22[edosteps].map(x => x.add([octaves]));
    else if (EDO == 12)
        return RATIOS12_11LIM[edosteps].map(x => x.add([octaves]));
    else
        alert("EDO not supported");
}

/**
 * A key-value-pair mapping edosteps to number of fifths spanned.
 *
 * This only works for edos where the fifth is a generator for the whole tuning.
 *
 * E.g. in 24 it won't work because there are 2 disjoint circles of fifths...
 *
 * This should be used for COSMETIC purposes only (like setting color hue based on fifths)
 */
export const EDOSTEPS_TO_FIFTHS_MAP = (() => {
    let x = {};
    let d = 0;
    // Number of edosteps for the best P5 approximation.
    // Assumes patent val/common 'default' 3-limit map.
    let fifthsize = Math.round(EDO * Math.log2(3 / 2));
    for (let fifths = 0; fifths < EDO; fifths++) {
        x[d] = fifths;
        d = (d + fifthsize) % EDO;
    }
    return x;
})();

/**
 * The vals covector that maps (non-octave-reduced) prime intervals to edosteps.
 *
 * @type {Object.<number, [number]>}
 */
export const VALS = (() => {
    let vals = {};
    let primes = [2, 3, 5, 7, 11];
    for (let edo of [12, 22, 31]) {
        vals[edo] = primes.map(prime => Math.round(edo * Math.log2(prime)));
    }
    return vals;
})();
