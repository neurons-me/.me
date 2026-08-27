use std::time::{Duration, Instant};

use serde_json::{json, Value as JsonValue};
use this_me::kernel::{Kernel, RecomputeMode, Value};

const ISOLATION_SIZES: &[usize] = &[10, 100, 1_000, 5_000, 10_000];
const ISOLATION_WARMUP: usize = 20;
const ISOLATION_RUNS: usize = 200;
const SUSTAINED_NODES: usize = 4_000;
const SUSTAINED_UPDATES: usize = 2_000;
const SUSTAINED_WINDOW: usize = 200;
const PUSH_PULL_CASES: &[PushPullCase] = &[
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
const SECRET_NODES: usize = 600;
const SECRET_WRITE_READ_RUNS: usize = 1_500;
const SECRET_DERIVATION_RUNS: usize = 240;

#[derive(Debug, Clone, Copy)]
struct PushPullCase {
    fanout: usize,
    iterations: usize,
}

fn main() {
    let output = json!({
        "suite": "this.me mirror benchmark",
        "implementation": "rust",
        "version": env!("CARGO_PKG_VERSION"),
        "cases": {
            "ok_isolation": run_ok_isolation(),
            "sustained_mutation": run_sustained_mutation(),
            "push_pull": run_push_pull(),
            "secret_scope": run_secret_scope(),
        }
    });

    println!("{}", serde_json::to_string_pretty(&output).unwrap());
}

fn run_ok_isolation() -> JsonValue {
    JsonValue::Array(
        ISOLATION_SIZES
            .iter()
            .map(|nodes| {
                let mut kernel = Kernel::new();

                for index in 0..*nodes {
                    kernel
                        .postulate(format!("bench.irrelevant[{index}].value"), index as u64)
                        .expect("irrelevant write should succeed");
                }

                kernel.postulate("order.price", 10_u64).unwrap();
                kernel.postulate("order.quantity", 3_u64).unwrap();
                kernel.derive("order", "total", "price * quantity").unwrap();

                for run in 0..ISOLATION_WARMUP {
                    let price = 11 + (run % 7) as u64;
                    kernel.postulate("order.price", price).unwrap();
                    assert_eq!(
                        kernel.read("order.total"),
                        Some(&Value::from((price * 3) as f64))
                    );
                }

                let mut samples = Vec::with_capacity(ISOLATION_RUNS);
                let mut result = Value::Null;
                for run in 0..ISOLATION_RUNS {
                    let price = 20 + (run % 7) as u64;
                    let started = Instant::now();
                    kernel.postulate("order.price", price).unwrap();
                    result = kernel.read("order.total").cloned().unwrap();
                    samples.push(started.elapsed());
                    assert_eq!(result, Value::from((price * 3) as f64));
                }
                samples.sort_unstable();

                let explanation = kernel.explain("order.total").unwrap();
                json!({
                    "nodes": nodes,
                    "runs": ISOLATION_RUNS,
                    "p50_ms": millis(percentile(&samples, 50)),
                    "p95_ms": millis(percentile(&samples, 95)),
                    "p99_ms": millis(percentile(&samples, 99)),
                    "max_ms": millis(*samples.last().unwrap()),
                    "k": explanation.meta.k,
                    "result": display_value(&result),
                    "memories": kernel.memories().len(),
                })
            })
            .collect(),
    )
}

fn run_sustained_mutation() -> JsonValue {
    let mut kernel = Kernel::new();

    for index in 1..=SUSTAINED_NODES {
        kernel
            .postulate(format!("items[{index}].value"), sustained_base_value(index))
            .unwrap();
        kernel
            .postulate(format!("items[{index}].factor"), 1_u64)
            .unwrap();
    }
    kernel.derive("items[1]", "score", "value * 2").unwrap();
    kernel
        .derive(
            format!("items[{SUSTAINED_NODES}]"),
            "score",
            "value * factor",
        )
        .unwrap();

    let mut samples = Vec::with_capacity(SUSTAINED_UPDATES);
    for update in 1..=SUSTAINED_UPDATES {
        let factor = (update % 17) + 1;
        let mutation_path = format!("items[{SUSTAINED_NODES}].factor");
        let started = Instant::now();
        kernel.postulate(mutation_path, factor as u64).unwrap();
        let score = kernel
            .read(format!("items[{SUSTAINED_NODES}].score"))
            .cloned()
            .unwrap();
        samples.push(started.elapsed());
        assert_eq!(
            score,
            Value::from((sustained_base_value(SUSTAINED_NODES) * factor as u64) as f64)
        );
    }

    json!({
        "nodes": SUSTAINED_NODES,
        "updates": SUSTAINED_UPDATES,
        "window": SUSTAINED_WINDOW,
        "overall": duration_summary(&samples),
        "windows": duration_windows(&samples, SUSTAINED_WINDOW),
        "p95_drift_pct": p95_drift_pct(&samples, SUSTAINED_WINDOW),
    })
}

fn run_push_pull() -> JsonValue {
    let rows = [RecomputeMode::Eager, RecomputeMode::Lazy]
        .into_iter()
        .flat_map(|mode| {
            PUSH_PULL_CASES
                .iter()
                .map(move |case| run_push_pull_case(*case, mode))
        })
        .collect::<Vec<_>>();

    JsonValue::Array(rows)
}

fn run_push_pull_case(case: PushPullCase, mode: RecomputeMode) -> JsonValue {
    let fanout = case.fanout;
    let read_path = format!("dep[{fanout}].result");
    let mut kernel = setup_push_pull_graph(fanout, mode);
    let mut mutation_samples = Vec::with_capacity(case.iterations);
    let mut read_samples = Vec::with_capacity(case.iterations);

    for iteration in 0..case.iterations {
        let next_master = (iteration % 97) + 2;

        let started = Instant::now();
        kernel
            .postulate("master.value", next_master as u64)
            .unwrap();
        mutation_samples.push(started.elapsed());

        let started = Instant::now();
        let result = kernel.read_fresh(read_path.clone()).unwrap();
        read_samples.push(started.elapsed());

        assert_eq!(
            result,
            Value::from((fanout as u64 * next_master as u64) as f64)
        );
    }

    mutation_samples.sort_unstable();
    read_samples.sort_unstable();
    let explanation = kernel.explain(read_path).unwrap();

    json!({
        "mode": recompute_mode_label(mode),
        "fanout": fanout,
        "iterations": case.iterations,
        "k": explanation.meta.k,
        "mutation_p50_ms": millis(percentile(&mutation_samples, 50)),
        "mutation_p95_ms": millis(percentile(&mutation_samples, 95)),
        "mutation_p99_ms": millis(percentile(&mutation_samples, 99)),
        "read_p50_ms": millis(percentile(&read_samples, 50)),
        "read_p95_ms": millis(percentile(&read_samples, 95)),
        "read_p99_ms": millis(percentile(&read_samples, 99)),
    })
}

fn setup_push_pull_graph(fanout: usize, mode: RecomputeMode) -> Kernel {
    let mut kernel = Kernel::new();
    kernel.set_recompute_mode(mode);
    kernel.postulate("master.value", 1_u64).unwrap();

    for index in 1..=fanout {
        kernel
            .postulate(format!("dep[{index}].value"), index as u64)
            .unwrap();
        kernel
            .derive(format!("dep[{index}]"), "result", "value * master.value")
            .unwrap();
    }

    assert_eq!(
        kernel.read_fresh(format!("dep[{fanout}].result")),
        Some(Value::from(fanout as f64))
    );
    kernel
}

fn run_secret_scope() -> JsonValue {
    JsonValue::Array(vec![
        measure_public_write_read(),
        measure_secret_write_read(),
        measure_public_derivation(),
        measure_secret_derivation(),
    ])
}

fn measure_public_write_read() -> JsonValue {
    let mut kernel = Kernel::new();
    kernel.postulate("public.value", 0_u64).unwrap();
    run_write_read_loop(
        kernel,
        "write_read",
        "public",
        "public.value",
        SECRET_WRITE_READ_RUNS,
    )
}

fn measure_secret_write_read() -> JsonValue {
    let mut kernel = Kernel::new();
    kernel.secret("secure", "bench-secret-2026").unwrap();
    kernel.postulate("secure.value", 0_u64).unwrap();
    run_write_read_loop(
        kernel,
        "write_read",
        "secret",
        "secure.value",
        SECRET_WRITE_READ_RUNS,
    )
}

fn measure_public_derivation() -> JsonValue {
    let mut kernel = Kernel::new();
    kernel.set_recompute_mode(RecomputeMode::Lazy);
    kernel.postulate("factor.value", 2_u64).unwrap();

    for index in 1..=SECRET_NODES {
        kernel
            .postulate(format!("pub[{index}].value"), secret_base_value(index))
            .unwrap();
        kernel
            .derive(format!("pub[{index}]"), "out", "value * factor.value")
            .unwrap();
    }

    assert_eq!(
        kernel.read_fresh(format!("pub[{SECRET_NODES}].out")),
        Some(Value::from((secret_base_value(SECRET_NODES) * 2) as f64))
    );

    run_derivation_loop(
        kernel,
        "derivation_lazy",
        "public",
        "factor.value",
        format!("pub[{SECRET_NODES}].out"),
        SECRET_DERIVATION_RUNS,
    )
}

fn measure_secret_derivation() -> JsonValue {
    let mut kernel = Kernel::new();
    kernel.set_recompute_mode(RecomputeMode::Lazy);
    kernel.secret("secure", "bench-secret-2026").unwrap();
    kernel.postulate("secure.factor", 2_u64).unwrap();

    for index in 1..=SECRET_NODES {
        kernel
            .postulate(
                format!("secure.data[{index}].value"),
                secret_base_value(index),
            )
            .unwrap();
        kernel
            .derive(
                format!("secure.data[{index}]"),
                "out",
                "value * secure.factor",
            )
            .unwrap();
    }

    assert_eq!(
        kernel.read_fresh(format!("secure.data[{SECRET_NODES}].out")),
        Some(Value::from((secret_base_value(SECRET_NODES) * 2) as f64))
    );

    run_derivation_loop(
        kernel,
        "derivation_lazy",
        "secret",
        "secure.factor",
        format!("secure.data[{SECRET_NODES}].out"),
        SECRET_DERIVATION_RUNS,
    )
}

fn run_write_read_loop(
    mut kernel: Kernel,
    case: &'static str,
    scope: &'static str,
    path: &str,
    iterations: usize,
) -> JsonValue {
    let mut samples = Vec::with_capacity(iterations);

    for iteration in 0..iterations {
        let value = (iteration % 17) + 1;
        let started = Instant::now();
        kernel.postulate(path, value as u64).unwrap();
        let result = kernel.read(path).cloned().unwrap();
        samples.push(started.elapsed());
        assert_eq!(result, Value::from(value as u64));
    }

    samples.sort_unstable();
    json!({
        "case": case,
        "scope": scope,
        "iterations": iterations,
        "p50_ms": millis(percentile(&samples, 50)),
        "p95_ms": millis(percentile(&samples, 95)),
        "p99_ms": millis(percentile(&samples, 99)),
        "k": 0,
    })
}

fn run_derivation_loop(
    mut kernel: Kernel,
    case: &'static str,
    scope: &'static str,
    mutation_path: &str,
    read_path: String,
    iterations: usize,
) -> JsonValue {
    let mut samples = Vec::with_capacity(iterations);

    for iteration in 0..iterations {
        let factor = (iteration % 7) + 1;
        let expected = secret_base_value(SECRET_NODES) * factor as u64;
        let started = Instant::now();
        kernel.postulate(mutation_path, factor as u64).unwrap();
        let result = kernel.read_fresh(read_path.clone()).unwrap();
        samples.push(started.elapsed());
        assert_eq!(result, Value::from(expected as f64));
    }

    samples.sort_unstable();
    let explanation = kernel.explain(read_path).unwrap();
    json!({
        "case": case,
        "scope": scope,
        "nodes": SECRET_NODES,
        "iterations": iterations,
        "p50_ms": millis(percentile(&samples, 50)),
        "p95_ms": millis(percentile(&samples, 95)),
        "p99_ms": millis(percentile(&samples, 99)),
        "k": explanation.meta.k,
    })
}

fn duration_summary(samples: &[Duration]) -> JsonValue {
    let mut sorted = samples.to_vec();
    sorted.sort_unstable();
    json!({
        "p50_ms": millis(percentile(&sorted, 50)),
        "p95_ms": millis(percentile(&sorted, 95)),
        "p99_ms": millis(percentile(&sorted, 99)),
        "max_ms": millis(*sorted.last().unwrap()),
    })
}

fn duration_windows(samples: &[Duration], window_size: usize) -> JsonValue {
    JsonValue::Array(
        samples
            .chunks(window_size)
            .enumerate()
            .map(|(index, window)| {
                let mut sorted = window.to_vec();
                sorted.sort_unstable();
                json!({
                    "start": index * window_size + 1,
                    "end": index * window_size + window.len(),
                    "p50_ms": millis(percentile(&sorted, 50)),
                    "p95_ms": millis(percentile(&sorted, 95)),
                    "p99_ms": millis(percentile(&sorted, 99)),
                })
            })
            .collect(),
    )
}

fn p95_drift_pct(samples: &[Duration], window_size: usize) -> f64 {
    let windows = samples.chunks(window_size).collect::<Vec<_>>();
    let Some(first) = windows.first() else {
        return 0.0;
    };
    let Some(last) = windows.last() else {
        return 0.0;
    };
    let mut first_sorted = first.to_vec();
    let mut last_sorted = last.to_vec();
    first_sorted.sort_unstable();
    last_sorted.sort_unstable();
    let first_p95 = millis(percentile(&first_sorted, 95));
    let last_p95 = millis(percentile(&last_sorted, 95));
    if first_p95 > 0.0 {
        ((last_p95 - first_p95) / first_p95) * 100.0
    } else {
        0.0
    }
}

fn sustained_base_value(index: usize) -> u64 {
    10 + (index % 7) as u64
}

fn secret_base_value(index: usize) -> u64 {
    100 + (index % 11) as u64
}

fn recompute_mode_label(mode: RecomputeMode) -> &'static str {
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

fn display_value(value: &Value) -> JsonValue {
    match value {
        Value::Null => JsonValue::Null,
        Value::Bool(value) => json!(value),
        Value::Number(value) => json!(value),
        Value::String(value) => json!(value),
        Value::Array(_) => json!("[array]"),
        Value::Object(_) => json!("{object}"),
        Value::Pointer(path) => json!(format!("->{}", path.join("."))),
        Value::Identity(id) => json!(format!("@{id}")),
    }
}
