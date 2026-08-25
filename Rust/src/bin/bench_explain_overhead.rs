use std::time::{Duration, Instant};

use this_me::kernel::{Kernel, Value};

const NODE_COUNT: usize = 3_000;
const ITERATIONS: usize = 120;

#[derive(Debug)]
struct BenchRow {
    mode: &'static str,
    p50_ms: f64,
    p95_ms: f64,
    p99_ms: f64,
    k: usize,
}

fn main() {
    println!("Rust .me explain overhead benchmark");
    println!("nodes={NODE_COUNT}, iterations={ITERATIONS}\n");
    println!("mode\tp50_ms\tp95_ms\tp99_ms\tk");

    let baseline = run_loop(setup(), false);
    let with_explain = run_loop(setup(), true);
    let explain_only = run_explain_only(setup());
    let overhead_pct = if baseline.p95_ms > 0.0 {
        ((with_explain.p95_ms - baseline.p95_ms) / baseline.p95_ms) * 100.0
    } else {
        0.0
    };

    print_row(&baseline);
    print_row(&with_explain);
    print_row(&explain_only);
    println!("\np95 overhead: {overhead_pct:.2}%");
}

fn setup() -> Kernel {
    let mut kernel = Kernel::new();

    kernel
        .postulate("factor", 2_u64)
        .expect("factor write should succeed");
    for index in 1..=NODE_COUNT {
        kernel
            .postulate(format!("nodes[{index}].value"), 100 + (index % 13) as u64)
            .expect("node value write should succeed");
        kernel
            .derive(format!("nodes[{index}]"), "out", "value * factor")
            .expect("node derivation should succeed");
    }

    assert_eq!(
        kernel.read(format!("nodes[{NODE_COUNT}].out")),
        Some(&Value::from((base_value() * 2) as f64))
    );
    kernel
}

fn run_loop(mut kernel: Kernel, with_explain: bool) -> BenchRow {
    let mut samples = Vec::with_capacity(ITERATIONS);
    let mut k = 0;

    for iteration in 0..ITERATIONS {
        let factor = (iteration % 9) + 1;
        let started = Instant::now();
        kernel
            .postulate("factor", factor as u64)
            .expect("factor mutation should succeed");
        let result = kernel
            .read(format!("nodes[{NODE_COUNT}].out"))
            .cloned()
            .expect("derived value should be readable");
        assert_eq!(result, Value::from((base_value() * factor as u64) as f64));

        if with_explain {
            let explanation = kernel
                .explain(format!("nodes[{NODE_COUNT}].out"))
                .expect("explain should succeed");
            k = explanation.meta.k;
            assert_eq!(k, NODE_COUNT);
            samples.push(started.elapsed());
        } else {
            samples.push(started.elapsed());
            k = kernel
                .explain(format!("nodes[{NODE_COUNT}].out"))
                .expect("baseline explain after timing should succeed")
                .meta
                .k;
            assert_eq!(k, NODE_COUNT);
        }
    }

    samples.sort_unstable();
    BenchRow {
        mode: if with_explain {
            "with_explain"
        } else {
            "baseline"
        },
        p50_ms: millis(percentile(&samples, 50)),
        p95_ms: millis(percentile(&samples, 95)),
        p99_ms: millis(percentile(&samples, 99)),
        k,
    }
}

fn run_explain_only(mut kernel: Kernel) -> BenchRow {
    kernel
        .postulate("factor", 3_u64)
        .expect("factor mutation should succeed");
    assert_eq!(
        kernel.read(format!("nodes[{NODE_COUNT}].out")),
        Some(&Value::from((base_value() * 3) as f64))
    );

    let mut samples = Vec::with_capacity(ITERATIONS);
    let mut k = 0;

    for _ in 0..ITERATIONS {
        let started = Instant::now();
        let explanation = kernel
            .explain(format!("nodes[{NODE_COUNT}].out"))
            .expect("explain should succeed");
        samples.push(started.elapsed());
        k = explanation.meta.k;
        assert_eq!(k, NODE_COUNT);
    }

    samples.sort_unstable();
    BenchRow {
        mode: "explain_only",
        p50_ms: millis(percentile(&samples, 50)),
        p95_ms: millis(percentile(&samples, 95)),
        p99_ms: millis(percentile(&samples, 99)),
        k,
    }
}

fn print_row(row: &BenchRow) {
    println!(
        "{}\t{:.6}\t{:.6}\t{:.6}\t{}",
        row.mode, row.p50_ms, row.p95_ms, row.p99_ms, row.k
    );
}

fn base_value() -> u64 {
    100 + (NODE_COUNT % 13) as u64
}

fn percentile(samples: &[Duration], percentile: usize) -> Duration {
    assert!(!samples.is_empty());
    let index = ((samples.len() - 1) * percentile).div_ceil(100);
    samples[index.min(samples.len() - 1)]
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
}
