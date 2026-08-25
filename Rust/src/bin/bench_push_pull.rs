use std::time::{Duration, Instant};

use this_me::kernel::{Kernel, RecomputeMode, Value};

const CASES: &[PushPullCase] = &[
    PushPullCase {
        fanout: 10,
        iterations: 150,
    },
    PushPullCase {
        fanout: 100,
        iterations: 150,
    },
    PushPullCase {
        fanout: 500,
        iterations: 80,
    },
    PushPullCase {
        fanout: 1_000,
        iterations: 50,
    },
    PushPullCase {
        fanout: 2_500,
        iterations: 20,
    },
    PushPullCase {
        fanout: 5_000,
        iterations: 10,
    },
];

#[derive(Debug, Clone, Copy)]
struct PushPullCase {
    fanout: usize,
    iterations: usize,
}

#[derive(Debug)]
struct BenchRow {
    mode: &'static str,
    fanout: usize,
    iterations: usize,
    k: usize,
    mutation_p50_ms: f64,
    mutation_p95_ms: f64,
    mutation_p99_ms: f64,
    read_p50_ms: f64,
    read_p95_ms: f64,
    read_p99_ms: f64,
}

fn main() {
    println!("Rust .me push vs pull benchmark");
    println!("mutation-only vs first-read-after-mutation\n");
    println!(
        "mode\tfanout\titerations\tk\tmutation_p50_ms\tmutation_p95_ms\tmutation_p99_ms\tread_p50_ms\tread_p95_ms\tread_p99_ms"
    );

    for mode in [RecomputeMode::Eager, RecomputeMode::Lazy] {
        for case in CASES {
            let row = run_case(*case, mode);
            print_row(&row);
        }
    }
}

fn run_case(case: PushPullCase, mode: RecomputeMode) -> BenchRow {
    let fanout = case.fanout;
    let read_path = format!("dep[{fanout}].result");
    let mut kernel = setup_graph(fanout, mode);
    let mut mutation_samples = Vec::with_capacity(case.iterations);
    let mut read_samples = Vec::with_capacity(case.iterations);

    for iteration in 0..case.iterations {
        let next_master = (iteration % 97) + 2;

        let started = Instant::now();
        kernel
            .postulate("master", next_master as u64)
            .expect("master mutation should succeed");
        mutation_samples.push(started.elapsed());

        let started = Instant::now();
        let result = kernel
            .read_fresh(read_path.clone())
            .expect("derived value should be readable");
        read_samples.push(started.elapsed());

        assert_eq!(
            result,
            Value::from((fanout as u64 * next_master as u64) as f64)
        );
    }

    mutation_samples.sort_unstable();
    read_samples.sort_unstable();

    let explanation = kernel
        .explain(read_path)
        .expect("explain should report recompute wave");

    BenchRow {
        mode: mode_label(mode),
        fanout,
        iterations: case.iterations,
        k: explanation.meta.k,
        mutation_p50_ms: millis(percentile(&mutation_samples, 50)),
        mutation_p95_ms: millis(percentile(&mutation_samples, 95)),
        mutation_p99_ms: millis(percentile(&mutation_samples, 99)),
        read_p50_ms: millis(percentile(&read_samples, 50)),
        read_p95_ms: millis(percentile(&read_samples, 95)),
        read_p99_ms: millis(percentile(&read_samples, 99)),
    }
}

fn setup_graph(fanout: usize, mode: RecomputeMode) -> Kernel {
    let mut kernel = Kernel::new();
    kernel.set_recompute_mode(mode);
    kernel
        .postulate("master", 1_u64)
        .expect("master write should succeed");

    for index in 1..=fanout {
        kernel
            .postulate(format!("dep[{index}].value"), index as u64)
            .expect("dep value write should succeed");
        kernel
            .derive(format!("dep[{index}]"), "result", "value * master")
            .expect("dep derivation should succeed");
    }

    assert_eq!(
        kernel.read_fresh(format!("dep[{fanout}].result")),
        Some(Value::from(fanout as f64))
    );
    kernel
}

fn print_row(row: &BenchRow) {
    println!(
        "{}\t{}\t{}\t{}\t{:.6}\t{:.6}\t{:.6}\t{:.6}\t{:.6}\t{:.6}",
        row.mode,
        row.fanout,
        row.iterations,
        row.k,
        row.mutation_p50_ms,
        row.mutation_p95_ms,
        row.mutation_p99_ms,
        row.read_p50_ms,
        row.read_p95_ms,
        row.read_p99_ms
    );
}

fn mode_label(mode: RecomputeMode) -> &'static str {
    match mode {
        RecomputeMode::Eager => "eager",
        RecomputeMode::Lazy => "lazy",
    }
}

fn percentile(samples: &[Duration], percentile: usize) -> Duration {
    assert!(!samples.is_empty());
    let index = ((samples.len() - 1) * percentile).div_ceil(100);
    samples[index.min(samples.len() - 1)]
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
}
