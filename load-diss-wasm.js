import init, {
    calculateDissonance,
    dissonanceMatrix,
    findOffender,
    findOffenderGraph,
    greet,
    load,
    selectCandidate,
    updateTonicity,
} from './dissonance-wasm/dissonance_wasm.js';

async function loadDissWasm() {
    console.log("Loading dissonance-wasm...")
    const w = await init("/dissonance-wasm/dissonance_wasm_bg.wasm");
    /*
        REMINDER TO SELF:

        DO NOT export w.calculateDissonance, etc... directly from the instance 'w', as it will use a
        completely different relative closure than importing the functions from the module using ES6
        modules.

        it will NOT WORK and result in tons of memory errors and undefined behavior!
    */

    console.log("dissonance-wasm webassembly loaded!")

    // TODO: uncomment this once finish debugging. Commenting this will postpone computing lookup
    // tables until the first note.

    load();

    console.dir(w);
    window.calculateDissonance = calculateDissonance;
    window.dissonanceMatrix = dissonanceMatrix;
    window.findOffender = findOffender;
    window.findOffenderGraph = findOffenderGraph;
    window.greet = greet;
    window.selectCandidate = selectCandidate;
    window.updateTonicity = updateTonicity;
    window.LOADED = true;
}

loadDissWasm();
