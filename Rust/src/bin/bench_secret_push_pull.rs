use std::time::{Duration, Instant};

use this_me::kernel::{Kernel, RecomputeMode, Value};

const CASES: &[usize] = &[100, 300, 600];
const ITERATIONS: usize = 300;
const MODE: RecomputeMode = RecomputeMode::Lazy;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Plane {
    Public,
    Secret,
}

#[derive(Debug)]
struct BenchRow {
    plane: Plane,
    nodes: usize,
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
    println!("Rust .me secret push vs pull benchmark");
    println!("mode={}, iterations={ITERATIONS}\n", mode_label(MODE));
    println!(
        "mode\tplane\tnodes\titerations\tk\tmutation_p50_ms\tmutation_p95_ms\tmutation_p99_ms\tread_p50_ms\tread_p95_ms\tread_p99_ms"
    );

    let mut rows = Vec::new();
    for nodes in CASES {
        for plane in [Plane::Public, Plane::Secret] {
            let row = run_case(*nodes, plane, MODE);
            print_row(&row);
            rows.push(row);
        }
    }

    println!("\nSecret/Public p95 slowdown ratios:");
    println!("nodes\tmutation_p95_slowdown_x\tread_p95_slowdown_x");
    for nodes in CASES {
        let public = rows
            .iter()
            .find(|row| row.nodes == *nodes && row.plane == Plane::Public)
            .expect("public row should exist");
        let secret = rows
            .iter()
            .find(|row| row.nodes == *nodes && row.plane == Plane::Secret)
            .expect("secret row should exist");
        println!(
            "{}\t{:.2}\t{:.2}",
            nodes,
            ratio(secret.mutation_p95_ms, public.mutation_p95_ms),
            ratio(secret.read_p95_ms, public.read_p95_ms)
        );
    }
}

fn run_case(nodes: usize, plane: Plane, mode: RecomputeMode) -> BenchRow {
    let mut kernel = setup_plane(nodes, plane, mode);
    let factor_path = factor_path(plane);
    let read_path = read_path(nodes, plane);
    let mut mutation_samples = Vec::with_capacity(ITERATIONS);
    let mut read_samples = Vec::with_capacity(ITERATIONS);

    for iteration in 0..ITERATIONS {
        let next = (iteration % 97) + 2;

        let started = Instant::now();
        kernel
            .postulate(factor_path, next as u64)
            .expect("factor mutation should succeed");
        mutation_samples.push(started.elapsed());

        let started = Instant::now();
        let result = kernel
            .read_fresh(read_path.clone())
            .expect("derived value should be readable");
        read_samples.push(started.elapsed());

        assert_eq!(
            result,
            Value::from((base_value(nodes) * next as u64) as f64)
        );
    }

    mutation_samples.sort_unstable();
    read_samples.sort_unstable();

    let explanation = kernel
        .explain(read_path)
        .expect("explain should report recompute wave");

    BenchRow {
        plane,
        nodes,
        iterations: ITERATIONS,
        k: explanation.meta.k,
        mutation_p50_ms: millis(percentile(&mutation_samples, 50)),
        mutation_p95_ms: millis(percentile(&mutation_samples, 95)),
        mutation_p99_ms: millis(percentile(&mutation_samples, 99)),
        read_p50_ms: millis(percentile(&read_samples, 50)),
        read_p95_ms: millis(percentile(&read_samples, 95)),
        read_p99_ms: millis(percentile(&read_samples, 99)),
    }
}

fn setup_plane(nodes: usize, plane: Plane, mode: RecomputeMode) -> Kernel {
    let mut kernel = Kernel::new();
    kernel.set_recompute_mode(mode);

    match plane {
        Plane::Public => {
            kernel
                .postulate("factor", 1_u64)
                .expect("public factor write should succeed");
            for index in 1..=nodes {
                kernel
                    .postulate(format!("pub[{index}].value"), base_value(index))
                    .expect("public value write should succeed");
                kernel
                    .derive(format!("pub[{index}]"), "out", "value * factor")
                    .expect("public derivation should succeed");
            }
        }
        Plane::Secret => {
            kernel
                .secret("secure", "bench-secret-2026")
                .expect("secret scope write should succeed");
            kernel
                .postulate("secure.factor", 1_u64)
                .expect("secret factor write should succeed");
            for index in 1..=nodes {
                kernel
                    .postulate(format!("secure.data[{index}].value"), base_value(index))
                    .expect("secret value write should succeed");
                kernel
                    .derive(
                        format!("secure.data[{index}]"),
                        "out",
                        "value * secure.factor",
                    )
                    .expect("secret derivation should succeed");
            }
        }
    }

    assert_eq!(
        kernel.read_fresh(read_path(nodes, plane)),
        Some(Value::from(base_value(nodes) as f64))
    );
    kernel
}

fn factor_path(plane: Plane) -> &'static str {
    match plane {
        Plane::Public => "factor",
        Plane::Secret => "secure.factor",
    }
}

fn read_path(nodes: usize, plane: Plane) -> String {
    match plane {
        Plane::Public => format!("pub[{nodes}].out"),
        Plane::Secret => format!("secure.data[{nodes}].out"),
    }
}

fn print_row(row: &BenchRow) {
    println!(
        "{}\t{}\t{}\t{}\t{}\t{:.6}\t{:.6}\t{:.6}\t{:.6}\t{:.6}\t{:.6}",
        mode_label(MODE),
        plane_label(row.plane),
        row.nodes,
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

fn plane_label(plane: Plane) -> &'static str {
    match plane {
        Plane::Public => "public",
        Plane::Secret => "secret",
    }
}

fn mode_label(mode: RecomputeMode) -> &'static str {
    match mode {
        RecomputeMode::Eager => "eager",
        RecomputeMode::Lazy => "lazy",
    }
}

fn ratio(numerator: f64, denominator: f64) -> f64 {
    if denominator > 0.0 {
        numerator / denominator
    } else {
        0.0
    }
}

fn base_value(index: usize) -> u64 {
    100 + (index % 17) as u64
}

fn percentile(samples: &[Duration], percentile: usize) -> Duration {
    assert!(!samples.is_empty());
    let index = ((samples.len() - 1) * percentile).div_ceil(100);
    samples[index.min(samples.len() - 1)]
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
}
