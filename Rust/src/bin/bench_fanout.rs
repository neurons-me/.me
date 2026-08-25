use std::time::{Duration, Instant};

use this_me::kernel::{Kernel, Value};

const CASES: &[FanoutCase] = &[
    FanoutCase {
        fanout: 10,
        iterations: 120,
    },
    FanoutCase {
        fanout: 100,
        iterations: 120,
    },
    FanoutCase {
        fanout: 500,
        iterations: 40,
    },
    FanoutCase {
        fanout: 1_000,
        iterations: 20,
    },
    FanoutCase {
        fanout: 2_500,
        iterations: 8,
    },
    FanoutCase {
        fanout: 5_000,
        iterations: 4,
    },
];

#[derive(Debug, Clone, Copy)]
struct FanoutCase {
    fanout: usize,
    iterations: usize,
}

#[derive(Debug)]
struct FanoutRow {
    fanout: usize,
    iterations: usize,
    k: usize,
    p50_ms: f64,
    p95_ms: f64,
    p99_ms: f64,
    max_ms: f64,
}

fn main() {
    println!("Rust .me fan-out sensitivity benchmark");
    println!("adaptive iterations keep large fanout runs bounded\n");
    println!("fanout\titerations\tk\tp50_ms\tp95_ms\tp99_ms\tmax_ms");

    for case in CASES {
        let row = run_fanout(*case);
        println!(
            "{}\t{}\t{}\t{:.6}\t{:.6}\t{:.6}\t{:.6}",
            row.fanout, row.iterations, row.k, row.p50_ms, row.p95_ms, row.p99_ms, row.max_ms
        );
    }
}

fn run_fanout(case: FanoutCase) -> FanoutRow {
    let fanout = case.fanout;
    let mut kernel = Kernel::new();

    kernel
        .postulate("master", 1_u64)
        .expect("master write should succeed");
    for index in 1..=fanout {
        kernel
            .postulate(format!("dep[{index}].value"), 10 + (index % 5) as u64)
            .expect("dep value write should succeed");
        kernel
            .derive(format!("dep[{index}]"), "result", "value * master")
            .expect("dep derivation should succeed");
    }

    assert_eq!(
        kernel.read(format!("dep[{fanout}].result")),
        Some(&Value::from((10 + (fanout % 5)) as f64))
    );

    let mut samples = Vec::with_capacity(case.iterations);

    for iteration in 0..case.iterations {
        let master = (iteration % 11) + 1;
        let started = Instant::now();
        kernel
            .postulate("master", master as u64)
            .expect("master mutation should succeed");
        let result = kernel
            .read(format!("dep[{fanout}].result"))
            .cloned()
            .expect("measured result should be readable");
        samples.push(started.elapsed());
        assert_eq!(result, Value::from(((10 + (fanout % 5)) * master) as f64));
    }

    samples.sort_unstable();
    let explanation = kernel
        .explain(format!("dep[{fanout}].result"))
        .expect("explain should report recompute wave");

    FanoutRow {
        fanout,
        iterations: case.iterations,
        k: explanation.meta.k,
        p50_ms: millis(percentile(&samples, 50)),
        p95_ms: millis(percentile(&samples, 95)),
        p99_ms: millis(percentile(&samples, 99)),
        max_ms: millis(*samples.last().expect("samples should not be empty")),
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
