use std::time::{Duration, Instant};

use this_me::kernel::{Kernel, Value};

const SIZES: &[usize] = &[10, 100, 1_000, 5_000, 10_000];
const WARMUP_RUNS: usize = 20;
const MEASURED_RUNS: usize = 200;

#[derive(Debug)]
struct BenchRow {
    nodes: usize,
    p50_ms: f64,
    p95_ms: f64,
    max_ms: f64,
    k: usize,
    result: Value,
    memories: usize,
}

fn main() {
    println!("Rust .me O(k) recompute benchmark");
    println!("runs: warmup={WARMUP_RUNS}, measured={MEASURED_RUNS}\n");
    println!("N\tp50_ms\tp95_ms\tmax_ms\tk\tresult\tmemories");

    for nodes in SIZES {
        let row = run_case(*nodes);
        println!(
            "{}\t{:.6}\t{:.6}\t{:.6}\t{}\t{}\t{}",
            row.nodes,
            row.p50_ms,
            row.p95_ms,
            row.max_ms,
            row.k,
            display_value(&row.result),
            row.memories
        );
    }
}

fn run_case(nodes: usize) -> BenchRow {
    let mut kernel = Kernel::new();

    for index in 0..nodes {
        kernel
            .postulate(format!("bench.irrelevant[{index}].value"), index as u64)
            .expect("irrelevant node write should succeed");
    }

    kernel
        .postulate("order.price", 10_u64)
        .expect("price write should succeed");
    kernel
        .postulate("order.quantity", 3_u64)
        .expect("quantity write should succeed");
    kernel
        .derive("order", "total", "price * quantity")
        .expect("derivation should succeed");

    for run in 0..WARMUP_RUNS {
        let price = 11 + (run % 7) as u64;
        kernel
            .postulate("order.price", price)
            .expect("warmup mutation should succeed");
        assert_eq!(
            kernel.read("order.total"),
            Some(&Value::from((price * 3) as f64))
        );
    }

    let mut samples = Vec::with_capacity(MEASURED_RUNS);
    let mut last_result = Value::Null;

    for run in 0..MEASURED_RUNS {
        let price = 20 + (run % 7) as u64;
        let started = Instant::now();
        kernel
            .postulate("order.price", price)
            .expect("measured mutation should succeed");
        last_result = kernel
            .read("order.total")
            .cloned()
            .expect("derived value should be readable");
        samples.push(started.elapsed());
        assert_eq!(last_result, Value::from((price * 3) as f64));
    }

    samples.sort_unstable();
    let explanation = kernel
        .explain("order.total")
        .expect("explain should report recompute wave");

    BenchRow {
        nodes,
        p50_ms: millis(percentile(&samples, 50)),
        p95_ms: millis(percentile(&samples, 95)),
        max_ms: millis(*samples.last().expect("samples should not be empty")),
        k: explanation.meta.k,
        result: last_result,
        memories: kernel.memories().len(),
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

fn display_value(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => {
            if value.fract() == 0.0 {
                format!("{value:.0}")
            } else {
                value.to_string()
            }
        }
        Value::String(value) => value.clone(),
        Value::Array(_) => "[array]".to_string(),
        Value::Object(_) => "{object}".to_string(),
        Value::Pointer(path) => format!("->{}", path.join(".")),
        Value::Identity(id) => format!("@{id}"),
    }
}
