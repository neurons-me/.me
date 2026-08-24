use this_me::kernel::{Kernel, KernelError, Value};

#[test]
fn public_write_read_round_trips() {
    let mut kernel = Kernel::new();

    kernel
        .postulate("apps.demo.title", "Demo Space")
        .expect("public write should succeed");

    assert_eq!(
        kernel.read("apps.demo.title"),
        Some(&Value::from("Demo Space"))
    );
}

#[test]
fn memory_log_is_history_index_is_latest_projection() {
    let mut kernel = Kernel::new();

    kernel.postulate("apps.demo.count", 1_u64).unwrap();
    kernel.postulate("apps.demo.count", 2_u64).unwrap();

    assert_eq!(kernel.memories().len(), 2);
    assert_eq!(kernel.read("apps.demo.count"), Some(&Value::from(2_u64)));
    assert_eq!(kernel.memories()[0].value, Value::from(1_u64));
    assert_eq!(
        kernel.memories()[1].prev_hash,
        Some(kernel.memories()[0].hash.clone())
    );
}

#[test]
fn snapshot_hydrates_equivalent_kernel() {
    let mut kernel = Kernel::new();

    kernel.postulate(["apps", "demo", "title"], "Demo").unwrap();
    kernel.postulate(["apps", "demo", "count"], 3_u64).unwrap();

    let restored = Kernel::hydrate(kernel.export_snapshot()).expect("snapshot should hydrate");

    assert_eq!(restored.memories(), kernel.memories());
    assert_eq!(restored.read("apps.demo.title"), Some(&Value::from("Demo")));
    assert_eq!(restored.read("apps.demo.count"), Some(&Value::from(3_u64)));
}

#[test]
fn hydration_rejects_tampered_memory() {
    let mut kernel = Kernel::new();

    kernel.postulate("apps.demo.title", "Demo").unwrap();
    let mut snapshot = kernel.export_snapshot();
    snapshot.memories[0].value = Value::from("Tampered");

    let error = Kernel::hydrate(snapshot).expect_err("tampering must be detected");

    assert!(matches!(
        error,
        KernelError::HydrationHashMismatch {
            path,
            expected: _,
            actual: _
        } if path == vec!["apps".to_string(), "demo".to_string(), "title".to_string()]
    ));
}

#[test]
fn hydration_rejects_broken_memory_chain() {
    let mut kernel = Kernel::new();

    kernel.postulate("apps.demo.title", "Demo").unwrap();
    kernel.postulate("apps.demo.count", 1_u64).unwrap();

    let mut snapshot = kernel.export_snapshot();
    snapshot.memories[1].prev_hash = None;

    let error = Kernel::hydrate(snapshot).expect_err("broken chain must be detected");

    assert!(matches!(
        error,
        KernelError::HydrationChainMismatch {
            index: 1,
            expected_prev_hash: Some(_),
            actual_prev_hash: None
        }
    ));
}

#[test]
fn empty_paths_are_rejected() {
    let mut kernel = Kernel::new();

    let error = kernel
        .postulate("", "nope")
        .expect_err("empty path cannot be written");

    assert_eq!(error, KernelError::EmptyPath);
}
