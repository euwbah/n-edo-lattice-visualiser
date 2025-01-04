
/**
 *
 * Returns the positive modulo of a number. Unlike the default `%` operator, this function will
 * return a positive number even if the dividend is negative.
 *
 * @param {number} n Dividend / numberator
 * @param {number} m Divisor / denominator
 * @returns
 */
export function mod(n, m) {
    return ((n % m) + m) % m;
}
