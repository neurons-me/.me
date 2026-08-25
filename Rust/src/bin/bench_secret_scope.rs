use std::time::{Duration, Instant};

use this_me::kernel::{Kernel, RecomputeMode, Value};

const NODE_COUNT: usize = 600;
const WRITE_READ_ITERATIONS: usize = 1_500;
const DERIVATION_ITERATIONS: usize = 240;

#[derive(Debug)]
struct BenchRow {
    case: &'static str,
    scope: &'static str,
    p50_ms: f64,
    p95_ms: f64,
    p99_ms: f64,
    k: usize,
}

fn main() {
    println!("Rust .me secret-scope performance impact benchmark");
    println!(
        "mode=lazy, nodes={NODE_COUNT}, write_read_iterations={WRITE_READ_ITERATIONS}, derivation_iterations={DERIVATION_ITERATIONS}\n"
    );
    println!("case\tscope\tp50_ms\tp95_ms\tp99_ms\tk");

    let public_write = measure_public_write_read();
    let secret_write = measure_secret_write_read();
    let public_derivation = measure_public_derivation();
    let secret_derivation = measure_secret_derivation();

    print_row(&public_write);
    print_row(&secret_write);
    print_row(&public_derivation);
    print_row(&secret_derivation);

    println!(
        "\nwrite_read secret-scope p95 slowdown: {:.2}%",
        slowdown_pct(&public_write, &secret_write)
    );
    println!(
        "derivation_lazy secret-scope p95 slowdown: {:.2}%",
        slowdown_pct(&public_derivation, &secret_derivation)
    );
}

fn measure_public_write_read() -> BenchRow {
    let mut kernel = Kernel::new();
    kernel
        .postulate("public.value", 0_u64)
        .expect("public value write should succeed");

    run_write_read_loop(
        kernel,
        "write_read",
        "public",
        "public.value",
        WRITE_READ_ITERATIONS,
    )
}

fn measure_secret_write_read() -> BenchRow {
    let mut kernel = Kernel::new();
    kernel
        .secret("secure", "bench-secret-2026")
        .expect("secret scope write should succeed");
    kernel
        .postulate("secure.value", 0_u64)
        .expect("secret value write should succeed");

    run_write_read_loop(
        kernel,
        "write_read",
        "secret",
        "secure.value",
        WRITE_READ_ITERATIONS,
    )
}

fn measure_public_derivation() -> BenchRow {
    let mut kernel = Kernel::new();
    kernel.set_recompute_mode(RecomputeMode::Lazy);
    kernel
        .postulate("factor", 2_u64)
        .expect("factor write should succeed");

    for index in 1..=NODE_COUNT {
        kernel
            .postulate(format!("pub[{index}].value"), base_value(index))
            .expect("public value write should succeed");
        kernel
            .derive(format!("pub[{index}]"), "out", "value * factor")
            .expect("public derivation should succeed");
    }

    assert_eq!(
        kernel.read_fresh(format!("pub[{NODE_COUNT}].out")),
        Some(Value::from((base_value(NODE_COUNT) * 2) as f64))
    );

    run_derivation_loop(kernel, "public", "factor", format!("pub[{NODE_COUNT}].out"))
}

fn measure_secret_derivation() -> BenchRow {
    let mut kernel = Kernel::new();
    kernel.set_recompute_mode(RecomputeMode::Lazy);
    kernel
        .secret("secure", "bench-secret-2026")
        .expect("secret scope write should succeed");
    kernel
        .postulate("secure.factor", 2_u64)
        .expect("secret factor write should succeed");

    for index in 1..=NODE_COUNT {
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

    assert_eq!(
        kernel.read_fresh(format!("secure.data[{NODE_COUNT}].out")),
        Some(Value::from((base_value(NODE_COUNT) * 2) as f64))
    );

    run_derivation_loop(
        kernel,
        "secret",
        "secure.factor",
        format!("secure.data[{NODE_COUNT}].out"),
    )
}

fn run_write_read_loop(
    mut kernel: Kernel,
    case: &'static str,
    scope: &'static str,
    path: &str,
    iterations: usize,
) -> BenchRow {
    let mut samples = Vec::with_capacity(iterations);

    for iteration in 0..iterations {
        let value = (iteration % 17) + 1;
        let started = Instant::now();
        kernel
            .postulate(path, value as u64)
            .expect("value mutation should succeed");
        let result = kernel
            .read(path)
            .cloned()
            .expect("written value should be readable");
        samples.push(started.elapsed());
        assert_eq!(result, Value::from(value as u64));
    }

    samples.sort_unstable();

    BenchRow {
        case,
        scope,
        p50_ms: millis(percentile(&samples, 50)),
        p95_ms: millis(percentile(&samples, 95)),
        p99_ms: millis(percentile(&samples, 99)),
        k: 0,
    }
}

fn run_derivation_loop(
    mut kernel: Kernel,
    scope: &'static str,
    factor_path: &str,
    read_path: String,
) -> BenchRow {
    let mut samples = Vec::with_capacity(DERIVATION_ITERATIONS);

    for iteration in 0..DERIVATION_ITERATIONS {
        let factor = (iteration % 7) + 1;
        let started = Instant::now();
        kernel
            .postulate(factor_path, factor as u64)
            .expect("factor mutation should succeed");
        let result = kernel
            .read_fresh(read_path.clone())
            .expect("derived value should be readable");
        samples.push(started.elapsed());
        assert_eq!(
            result,
            Value::from((base_value(NODE_COUNT) * factor as u64) as f64)
        );
    }

    samples.sort_unstable();
    let explanation = kernel
        .explain(read_path)
        .expect("explain should report recompute wave");

    BenchRow {
        case: "derivation_lazy",
        scope,
        p50_ms: millis(percentile(&samples, 50)),
        p95_ms: millis(percentile(&samples, 95)),
        p99_ms: millis(percentile(&samples, 99)),
        k: explanation.meta.k,
    }
}

fn print_row(row: &BenchRow) {
    println!(
        "{}\t{}\t{:.6}\t{:.6}\t{:.6}\t{}",
        row.case, row.scope, row.p50_ms, row.p95_ms, row.p99_ms, row.k
    );
}

fn slowdown_pct(public: &BenchRow, secret: &BenchRow) -> f64 {
    if public.p95_ms > 0.0 {
        ((secret.p95_ms - public.p95_ms) / public.p95_ms) * 100.0
    } else {
        0.0
    }
}

fn base_value(index: usize) -> u64 {
    100 + (index % 11) as u64
}

fn percentile(samples: &[Duration], percentile: usize) -> Duration {
    assert!(!samples.is_empty());
    let index = ((samples.len() - 1) * percentile).div_ceil(100);
    samples[index.min(samples.len() - 1)]
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
}
