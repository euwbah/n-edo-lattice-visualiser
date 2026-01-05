# dissonance-wasm

A WASM module for modelling perceived dissonance, tonicity (root-detection & note persistence), and
pitch memory of up to 8 notes in real-time, in any tuning system (inputs are frequencies in Hz).

The magic engine behind https://github.com/euwbah/n-edo-lattice-visualiser.

## Compilation

1. `cargo install wasm-pack`
2. `wasm-pack build --target web` (for non-bundlers, plain HTML/JS with es6 modules)
3. Output will be in `./pkg`

## Usage

If built using `--target web` for non-bundler usage, import as an es6 module:
```html
<script type="module">
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
</script>
```

See [dissonance_wasm.d.ts](pkg/dissonance_wasm.d.ts) for function signatures and documentation.

You'll probably just use

- `selectCandidate` for choosing the best detemperament candidate and best existing note for the candidate to be heard relative to