/* tslint:disable */
/* eslint-disable */
/**
 * Evaluate tonicity and dissonaance of the current state of notes.
 *
 * Returns a list of floats `[tonicity_1, tonicity_2, ..., diss_1, diss_2, ..., dissonance]` where:
 *
 * * `tonicity_i` is the relative tonicity of the i-th note. (Tonicities sum to 1)
 * * `diss_i` is the average dissonance per traversal of each note
 * * `dissonance` is the final evaluated dissonance of the chord.
 */
export function updateTonicity(freqs: Float64Array, context: Float64Array, elapsed_seconds: number): Float64Array;
/**
 * Quick and less accurate version of `updateTonicity`.
 *
 * Use this to check whether new octave of existing note should override the existing octave
 * equivalent note in the context.
 *
 * Returns a list of floats `[tonicity_1, tonicity_2, ..., diss_1, diss_2, ..., dissonance]` where:
 *
 * * `tonicity_i` is the relative tonicity of the i-th note. (Tonicities sum to 1)
 * * `diss_i` is the average dissonance per traversal of each note
 * * `dissonance` is the final evaluated dissonance of the chord.
 */
export function quickGraphDiss(freqs: Float64Array, context: Float64Array): Float64Array;
/**
 * NOTE: call this in js as `findOffenderGraph(freqs, context)`. Not to be confused with
 * `findOffender(freqs)`, the legacy polyadic roughness-only method.
 */
export function findOffenderGraph(freqs: Float64Array, context: Float64Array): number;
/**
 * For figuring out the best detemperament option of a new note. A list of existing notes in the
 * harmonic tonicity context is given in `freqs`, which are candidates for the 'root' of the new
 * note, i.e. from which existing note should the new note be related to.
 *
 * Then, for each candidate root in `freqs`, a list of candidate ratios (given as multiples, i.e.
 * 1.5 = 3/2 = fifth) are provided in `candidate_ratios`.
 *
 * E.g., if `freqs` is `[200, 300]` and `candidate_ratios` is `[[2.0, 3.0], [1.5, 2.0]]`, then we
 * will consider attaching 400 Hz and 600 Hz to the first root note, and 450 Hz and 600 Hz to the
 * second root note. However, since the 600 Hz can belong to both root notes, we will give priority
 * to the higher tonicity root note.
 *
 * ### Parameters
 *
 * * `freqs`: List of existing notes in the harmonic tonicity context.
 * * `context`: List of tonicity values of the existing notes in the harmonic tonicity context.
 * * `candidate_ratios`: 2D array of candidate ratios for each candidate root.
 * * `num_root_candidates`: Number of candidate root notes to consider. Candidate root notes will
 *   be sorted by tonicity and higher priority will be given to higher tonicity root notes.
 *
 * The function returns the 0-based index of the best candidate root and the best candidate ratio.
 *
 * ### Warning
 *
 * `freqs` should have 7 notes at the absolute maximum (even 7 will be slow). If the error isn't
 * too large, when the harmonic context already has 7 notes, remove one first by finding the
 * offender, then run this with 6 notes in the harmonic context.
 */
export function selectCandidate(freqs: Float64Array, context: Float64Array, candidate_ratios: any, num_root_candidates: number): Uint32Array;
export function greet(): void;
/**
 * Pre load things that need to be pre-calculated.
 *
 * Call `load()` first after loading the WASM module to populate lookup tables. (Takes around
 * 15-20s). Otherwise, the first call to any graph dissonance will lazily load the tables.
 */
export function load(): void;
/**
 * Sethares's dissonance with 16 harmonics, any number of notes.
 */
export function calculateDissonance(freqs: Float64Array): number;
export function dissonanceMatrix(matrix: Array<any>): Int32Array;
export function findOffender(freqs: Float64Array): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly updateTonicity: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
  readonly quickGraphDiss: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly findOffenderGraph: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly selectCandidate: (a: number, b: number, c: number, d: number, e: any, f: number) => [number, number, number, number];
  readonly load: () => [number, number];
  readonly calculateDissonance: (a: number, b: number) => number;
  readonly dissonanceMatrix: (a: any) => [number, number];
  readonly findOffender: (a: number, b: number) => number;
  readonly greet: () => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
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
