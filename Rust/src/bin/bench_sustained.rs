use std::time::{Duration, Instant};

use this_me::kernel::{Kernel, Value};

const NODE_COUNT: usize = 4_000;
const UPDATES: usize = 2_000;
const WINDOW_SIZE: usize = 200;

#[derive(Debug)]
struct WindowRow {
    start: usize,
    end: usize,
    p50_ms: f64,
    p95_ms: f64,
    p99_ms: f64,
}

#[derive(Debug)]
struct OverallRow {
    p50_ms: f64,
    p95_ms: f64,
    p99_ms: f64,
    max_ms: f64,
}

fn main() {
    println!("Rust .me sustained mutation benchmark");
    println!("nodes={NODE_COUNT}, updates={UPDATES}, window={WINDOW_SIZE}\n");

    let result = run_sustained_mutation();

    println!("Summary:");
    println!("p50_ms\tp95_ms\tp99_ms\tmax_ms");
    println!(
        "{:.6}\t{:.6}\t{:.6}\t{:.6}",
        result.overall.p50_ms, result.overall.p95_ms, result.overall.p99_ms, result.overall.max_ms
    );

    println!("\nWindowed p95 drift check:");
    println!("window\tp50_ms\tp95_ms\tp99_ms");
    for window in &result.windows {
        println!(
            "{}-{}\t{:.6}\t{:.6}\t{:.6}",
            window.start, window.end, window.p50_ms, window.p95_ms, window.p99_ms
        );
    }

    let first = result
        .windows
        .first()
        .map(|window| window.p95_ms)
        .unwrap_or_default();
    let last = result
        .windows
        .last()
        .map(|window| window.p95_ms)
        .unwrap_or_default();
    let drift = if first > 0.0 {
        (last - first) / first
    } else {
        0.0
    };
    println!("\np95 drift: {:.2}%", drift * 100.0);
}

struct SustainedResult {
    overall: OverallRow,
    windows: Vec<WindowRow>,
}

fn run_sustained_mutation() -> SustainedResult {
    let mut kernel = Kernel::new();

    for index in 1..=NODE_COUNT {
        kernel
            .postulate(format!("items[{index}].value"), 10 + (index % 7) as u64)
            .expect("item value write should succeed");
    }
    kernel
        .derive("items[1]", "score", "value * 2")
        .expect("warm item derivation should succeed");
    kernel
        .derive(format!("items[{NODE_COUNT}]"), "score", "value * 2")
        .expect("measured item derivation should succeed");

    assert_eq!(
        kernel.read(format!("items[{NODE_COUNT}].score")),
        Some(&Value::from((base_value() * 2) as f64))
    );

    let mut samples = Vec::with_capacity(UPDATES);

    for update in 1..=UPDATES {
        let value = base_value() + (update % 17) as u64;
        let started = Instant::now();
        kernel
            .postulate(format!("items[{NODE_COUNT}].value"), value)
            .expect("item mutation should succeed");
        let score = kernel
            .read(format!("items[{NODE_COUNT}].score"))
            .cloned()
            .expect("measured score should be readable");
        samples.push(started.elapsed());
        assert_eq!(score, Value::from((value * 2) as f64));
    }

    let mut sorted = samples.clone();
    sorted.sort_unstable();

    let windows = samples
        .chunks(WINDOW_SIZE)
        .enumerate()
        .map(|(index, window)| {
            let mut sorted_window = window.to_vec();
            sorted_window.sort_unstable();
            WindowRow {
                start: index * WINDOW_SIZE + 1,
                end: index * WINDOW_SIZE + window.len(),
                p50_ms: millis(percentile(&sorted_window, 50)),
                p95_ms: millis(percentile(&sorted_window, 95)),
                p99_ms: millis(percentile(&sorted_window, 99)),
            }
        })
        .collect::<Vec<_>>();

    SustainedResult {
        overall: OverallRow {
            p50_ms: millis(percentile(&sorted, 50)),
            p95_ms: millis(percentile(&sorted, 95)),
            p99_ms: millis(percentile(&sorted, 99)),
            max_ms: millis(*sorted.last().expect("samples should not be empty")),
        },
        windows,
    }
}

fn base_value() -> u64 {
    10 + (NODE_COUNT % 7) as u64
}

fn percentile(samples: &[Duration], percentile: usize) -> Duration {
    assert!(!samples.is_empty());
    let index = ((samples.len() - 1) * percentile).div_ceil(100);
    samples[index.min(samples.len() - 1)]
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
}
