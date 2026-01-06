import init, {
    loadLookupTables,
    selectCandidate,
    updateTonicity,
} from './dissonance-wasm/dissonance_wasm.js';

async function loadDissWasm() {
    console.log("Loading dissonance-wasm...")

    const w = await init("dissonance-wasm/dissonance_wasm_bg.wasm");
    /*
        REMINDER TO SELF:

        DO NOT export w.calculateDissonance, etc... directly from the instance 'w', as it will use a
        completely different relative closure than importing the functions from the module using ES6
        modules.

        it will NOT WORK and result in tons of memory errors and undefined behavior!
    */

    console.log("dissonance-wasm webassembly loaded!")

    loadLookupTables();

    console.dir(w);

    window.selectCandidate = selectCandidate;
    window.updateTonicity = updateTonicity;
    window.LOADED = true;
}

loadDissWasm();
