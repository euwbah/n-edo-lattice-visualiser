let wasm;

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayI32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

let cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

/**
 * Sethares's dissonance with 16 harmonics, any number of notes.
 * @param {Float64Array} freqs
 * @returns {number}
 */
export function calculateDissonance(freqs) {
    const ptr0 = passArrayF64ToWasm0(freqs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.calculateDissonance(ptr0, len0);
    return ret;
}

/**
 * @param {Array<any>} matrix
 * @returns {Int32Array}
 */
export function dissonanceMatrix(matrix) {
    const ret = wasm.dissonanceMatrix(matrix);
    var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * @param {Float64Array} freqs
 * @returns {number}
 */
export function findOffender(freqs) {
    const ptr0 = passArrayF64ToWasm0(freqs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.findOffender(ptr0, len0);
    return ret >>> 0;
}

export function greet() {
    wasm.greet();
}

/**
 * Pre load things that need to be pre-calculated.
 * @returns {boolean}
 */
export function loadLookupTables() {
    const ret = wasm.loadLookupTables();
    return ret !== 0;
}

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
 * @param {Float64Array} freqs
 * @param {Uint32Array} num_cands_per_freq
 * @param {Float64Array} candidate_ratios
 * @param {Float64Array} context
 * @param {number} elapsed_seconds
 * @param {number} top_n_roots
 * @param {number} method
 * @returns {Float64Array}
 */
export function selectCandidate(freqs, num_cands_per_freq, candidate_ratios, context, elapsed_seconds, top_n_roots, method) {
    const ptr0 = passArrayF64ToWasm0(freqs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(num_cands_per_freq, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(candidate_ratios, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(context, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.selectCandidate(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, elapsed_seconds, top_n_roots, method);
    var v5 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v5;
}

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
 * @param {Float64Array} freqs
 * @param {Float64Array} context
 * @param {number} elapsed_seconds
 * @returns {Float64Array}
 */
export function updateTonicity(freqs, context, elapsed_seconds) {
    const ptr0 = passArrayF64ToWasm0(freqs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(context, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.updateTonicity(ptr0, len0, ptr1, len1, elapsed_seconds);
    var v3 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v3;
}

const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg___wbindgen_number_get_9619185a74197f95 = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'number' ? obj : undefined;
        getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    };
    imports.wbg.__wbg___wbindgen_throw_dd24417ed36fc46e = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_alert_745db52756414be1 = function(arg0, arg1) {
        alert(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_from_29a8414a7a7cd19d = function(arg0) {
        const ret = Array.from(arg0);
        return ret;
    };
    imports.wbg.__wbg_get_6b7bd52aca3f9671 = function(arg0, arg1) {
        const ret = arg0[arg1 >>> 0];
        return ret;
    };
    imports.wbg.__wbg_length_d45040a40c570362 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
    };

    return imports;
}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedInt32ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('dissonance_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
