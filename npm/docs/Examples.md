```ts
me.studio.synth.moog.osc1.freq(440);
me.studio.synth.moog.osc2.freq(445);
// "Master Knob": Apply logic across the entire tree
me.studio.synth.moog["osc[i]"]["="]("detune", "freq * 1.02");
me("studio.synth.moog.osc1.detune"); // → 448.8
```