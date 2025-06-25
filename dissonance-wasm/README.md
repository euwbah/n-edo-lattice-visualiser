Used in https://github.com/euwbah/31edo-lattice-visualiser

Exports functions for calculating perceived dissonance
of musical frequencies:

`calculateDissonance(frequencies: [float])` Uses Sethares' Dissmeasure Algorithm to evaluate
the dissonance score of any number of frequencies.

`dissonanceMatrix(matrix: [[[float]]])` Takes in an array of array of array of frequencies
(where `f[i][j]` is a list of frequencies) and returns the indexes
`i` & `j` as a two-element array such that `f[i][j]` gives the lowest dissonance
score amongst all the list of frequencies in the matrix. See
https://github.com/euwbah/31edo-lattice-visualiser/blame/9b76985ca53ab4319f0e742cd7175b2a10c7344e/harmonic-context.js#L105
for usage.

`findOffender(frequencies: [float])` will return the index of the
frequency that, when removed from the list, will result in the
largest drop in dissonance score. The last element of `frequencies`
will not be regarded as a potential candidate.