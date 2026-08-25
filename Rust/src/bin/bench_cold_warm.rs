use std::time::{Duration, Instant};

use this_me::kernel::{Kernel, Snapshot, Value};

const CASES: &[usize] = &[100, 1_000, 5_000, 10_000];
const HYDRATION_RUNS: usize = 50;
const STEADY_RUNS: usize = 200;

#[derive(Debug)]
struct ColdWarmRow {
    nodes: usize,
    memories: usize,
    cold_hydrate_p50_ms: f64,
    cold_hydrate_p95_ms: f64,
    first_write_ms: f64,
    steady_avg_ms: f64,
    steady_p95_ms: f64,
    k: usize,
}

fn main() {
    println!("Rust .me cold vs warm runtime benchmark");
    println!("hydration_runs={HYDRATION_RUNS}, steady_runs={STEADY_RUNS}\n");
    println!(
        "nodes\tmemories\tcold_hydrate_p50_ms\tcold_hydrate_p95_ms\tfirst_write_ms\tsteady_avg_ms\tsteady_p95_ms\tk"
    );

    for nodes in CASES {
        let row = run_case(*nodes);
        println!(
            "{}\t{}\t{:.6}\t{:.6}\t{:.6}\t{:.6}\t{:.6}\t{}",
            row.nodes,
            row.memories,
            row.cold_hydrate_p50_ms,
            row.cold_hydrate_p95_ms,
            row.first_write_ms,
            row.steady_avg_ms,
            row.steady_p95_ms,
            row.k
        );
    }
}

fn run_case(nodes: usize) -> ColdWarmRow {
    let snapshot = build_snapshot(nodes);
    let memories = snapshot.memories.len();

    let mut hydration_samples = Vec::with_capacity(HYDRATION_RUNS);
    for _ in 0..HYDRATION_RUNS {
        let input = snapshot.clone();
        let started = Instant::now();
        let restored = Kernel::hydrate(input).expect("snapshot should hydrate");
        hydration_samples.push(started.elapsed());
        assert_score(&restored, nodes, 1);
    }
    hydration_samples.sort_unstable();

    let mut kernel = Kernel::hydrate(snapshot).expect("snapshot should hydrate for mutation");
    let started = Instant::now();
    kernel
        .postulate("factor", 2_u64)
        .expect("first warm mutation should succeed");
    let first_write = started.elapsed();
    assert_score(&kernel, nodes, 2);

    let mut steady_samples = Vec::with_capacity(STEADY_RUNS);
    for iteration in 0..STEADY_RUNS {
        let factor = (iteration % 17) + 3;
        let started = Instant::now();
        kernel
            .postulate("factor", factor as u64)
            .expect("steady mutation should succeed");
        steady_samples.push(started.elapsed());
        assert_score(&kernel, nodes, factor as u64);
    }
    steady_samples.sort_unstable();

    let explanation = kernel
        .explain(format!("items[{nodes}].score"))
        .expect("explain should report last recompute wave");

    ColdWarmRow {
        nodes,
        memories,
        cold_hydrate_p50_ms: millis(percentile(&hydration_samples, 50)),
        cold_hydrate_p95_ms: millis(percentile(&hydration_samples, 95)),
        first_write_ms: millis(first_write),
        steady_avg_ms: millis(average(&steady_samples)),
        steady_p95_ms: millis(percentile(&steady_samples, 95)),
        k: explanation.meta.k,
    }
}

fn build_snapshot(nodes: usize) -> Snapshot {
    let mut kernel = Kernel::new();

    for index in 1..=nodes {
        kernel
            .postulate(format!("items[{index}].value"), base_value(index))
            .expect("item value write should succeed");
    }
    kernel
        .postulate("factor", 1_u64)
        .expect("factor write should succeed");
    kernel
        .derive(format!("items[{nodes}]"), "score", "value * factor")
        .expect("derivation should succeed");

    assert_score(&kernel, nodes, 1);
    kernel.export_snapshot()
}

fn assert_score(kernel: &Kernel, nodes: usize, factor: u64) {
    assert_eq!(
        kernel.read(format!("items[{nodes}].score")),
        Some(&Value::from((base_value(nodes) * factor) as f64))
    );
}

fn base_value(index: usize) -> u64 {
    10 + (index % 7) as u64
}

fn percentile(samples: &[Duration], percentile: usize) -> Duration {
    assert!(!samples.is_empty());
    let index = ((samples.len() - 1) * percentile).div_ceil(100);
    samples[index.min(samples.len() - 1)]
}

fn average(samples: &[Duration]) -> Duration {
    assert!(!samples.is_empty());
    let total_nanos = samples.iter().map(Duration::as_nanos).sum::<u128>() / samples.len() as u128;
    Duration::from_nanos(total_nanos as u64)
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
}
