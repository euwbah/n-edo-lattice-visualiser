/* tslint:disable */
/* eslint-disable */

/**
 * Sethares's dissonance with 16 harmonics, any number of notes.
 */
export function calculateDissonance(freqs: Float64Array): number;

export function dissonanceMatrix(matrix: Array<any>): Int32Array;

export function findOffender(freqs: Float64Array): number;

export function greet(): void;

/**
 * Pre load things that need to be pre-calculated.
 */
export function loadLookupTables(): boolean;

/**
 * Given the existing `freqs` in pitch memery, the number of candidates per root, and a flattened
 * array of the ratios for each candidate for each root in `freqs`, select the best candidate root
 * and candidate ratio.
 *
 * - `freqs`: List of frequencies in pitch memory.
 *
 * - `num_cands_per_freq`: How many candidate ratios per frequency in `freqs` short term memory
 *
 * - `candidate_ratios`: Flattened array of frequency multiples of frequencies in `freqs`.
 *
 * - `context`: Current tonicity context (should be same length as freqs)
 *
 * - `elapsed_seconds`: Time elapsed since last update, in seconds.
 *
 * - `top_n_roots`: How many notes in `freqs` should be considered as relative roots for candidate
 *   frequencies. Only the top n highest tonicity notes in `freqs` will be considered.
 *
 * - `method`: 0 to select candidate with minimum dissonance, 1 to select candidate with maximum
 *   tonicity.
 *
 * E.g., if freqs = [200, 300] and cands_per_freq = [1, 2], and candidate_ratios = [1.5, 2, 1.5]
 *
 * then the candidates are:
 *
 * - 1.5 * 200hz = 300hz seen relative to 200hz,
 * - 2 * 300hz = 600hz seen relative to 300hz,
 * - 1.5 * 300hz = 450hz seen relative to 300hz.
 *
 * ## Returns
 *
 * (cand_idx, cand_ratio_idx, tonicity_1, tonicity_2, ..., tonicity_cand)
 *
 * - `cand_idx`: Index of which note in short term memory the candidate note is heard relative to.
 *
 * - `cand_ratio_idx`: Index of which candidate ratio should be used (as per the unflattened array)
 *
 * - `tonicity_1, ..., tonicity_cand`: the tonicities of the existing notes in the same order as
 *   freqs, together with the tonicity of the newly added candidate note at the end, rescaled so
 *   that tonicities sum to 1 after including the candidate.
 *
 * of the index of frequency in `freqs` and the index of the candidate ratio (relative to the
 * unflattened map, not the flattened one).
 *
 * E.g. using the above example candidates, a return value of (1, 0, t_1, t_2, t_3) means the
 * algorithm has selected the second freq 300hz and the first candidate ratio of the second freqs
 * which is 2, so the selected candidate is 2/1 of 300hz. The tonicities t_1, t_2 correspond to the
 * updated tonicities of freqs[0] and freqs[1], after including the new candidate frequency, and
 * t_3 is the tonicity of the new candidate frequency.
 */
export function selectCandidate(freqs: Float64Array, num_cands_per_freq: Uint32Array, candidate_ratios: Float64Array, context: Float64Array, elapsed_seconds: number, top_n_roots: number, method: number): Float64Array;

/**
 * Evaluate tonicity and dissonaance of the current state of notes.
 *
 *  * `freqs`: List of frequencies in pitch memory.
 *  * `context`: Current tonicity context (should be same length as freqs)
 *  * `elapsed_seconds`: Time elapsed since last update, in seconds.
 *
 * Returns a list of floats `[tonicity_1, tonicity_2, ..., dissonance]` where:
 *
 *  * `tonicity_i` is the relative tonicity of the i-th note. (Tonicities sum to 1)
 *  * `dissonance` is the final evaluated dissonance of the chord.
 */
export function updateTonicity(freqs: Float64Array, context: Float64Array, elapsed_seconds: number): Float64Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly updateTonicity: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly selectCandidate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => [number, number];
  readonly loadLookupTables: () => number;
  readonly calculateDissonance: (a: number, b: number) => number;
  readonly dissonanceMatrix: (a: any) => [number, number];
  readonly findOffender: (a: number, b: number) => number;
  readonly greet: () => void;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
