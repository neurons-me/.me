import ME from "../dist/index.js";

const me = new ME() as any;
if (typeof me.setRecomputeMode === "function") me.setRecomputeMode("eager");

const N = 20000;
me.master.factor(1);

const stages = [2000, 4000, 8000, 12000, 16000, 20000];
const costs: Record<number, number> = {};
let stageStart = performance.now();
let prevStage = 0;

for (let i = 1; i <= N; i++) {
  me.dep[i].value(i);
  me.dep[i]["="]("out", "value * master.factor");
  if (stages.includes(i)) {
    const now = performance.now();
    const count = i - prevStage;
    costs[i] = (now - stageStart) / count * 1000;
    stageStart = now;
    prevStage = i;
  }
}

console.log("μs per node at each stage:");
stages.forEach(s => console.log(`  n=${s}: ${costs[s].toFixed(1)}μs/node`));
