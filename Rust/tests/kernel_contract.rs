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

#[test]
fn remove_deletes_exact_path_and_descendants_from_index() {
    let mut kernel = Kernel::new();

    kernel.postulate("apps.demo.title", "Demo").unwrap();
    kernel.postulate("apps.demo.count", 2_u64).unwrap();
    kernel.postulate("apps.other.title", "Other").unwrap();

    let memory = kernel.remove("apps.demo").unwrap();

    assert_eq!(memory.operator.as_deref(), Some("-"));
    assert_eq!(memory.path, vec!["apps".to_string(), "demo".to_string()]);
    assert_eq!(memory.value, Value::Null);
    assert_eq!(kernel.read("apps.demo.title"), None);
    assert_eq!(kernel.read("apps.demo.count"), None);
    assert_eq!(kernel.read("apps.other.title"), Some(&Value::from("Other")));
}

#[test]
fn remove_exact_leaf_does_not_delete_siblings() {
    let mut kernel = Kernel::new();

    kernel.postulate("apps.demo.title", "Demo").unwrap();
    kernel.postulate("apps.demo.count", 2_u64).unwrap();

    kernel.remove("apps.demo.title").unwrap();

    assert_eq!(kernel.read("apps.demo.title"), None);
    assert_eq!(kernel.read("apps.demo.count"), Some(&Value::from(2_u64)));
}

#[test]
fn remove_replays_through_snapshot_hydration() {
    let mut kernel = Kernel::new();

    kernel.postulate("apps.demo.title", "Demo").unwrap();
    kernel.postulate("apps.demo.count", 2_u64).unwrap();
    kernel.remove("apps.demo").unwrap();

    let restored = Kernel::hydrate(kernel.export_snapshot()).unwrap();

    assert_eq!(restored.memories(), kernel.memories());
    assert_eq!(restored.read("apps.demo.title"), None);
    assert_eq!(restored.read("apps.demo.count"), None);
}

#[test]
fn pointer_redirects_exact_path_reads() {
    let mut kernel = Kernel::new();

    kernel.postulate("apps.demo.title", "Demo").unwrap();
    let memory = kernel
        .pointer("apps.alias.title", "apps.demo.title")
        .unwrap();

    assert_eq!(memory.operator.as_deref(), Some("__"));
    assert_eq!(
        memory.value,
        Value::Pointer(vec![
            "apps".to_string(),
            "demo".to_string(),
            "title".to_string(),
        ])
    );
    assert_eq!(kernel.read("apps.alias.title"), Some(&Value::from("Demo")));
}

#[test]
fn pointer_redirects_prefix_reads() {
    let mut kernel = Kernel::new();

    kernel.postulate("apps.demo.title", "Demo").unwrap();
    kernel.postulate("apps.demo.count", 2_u64).unwrap();
    kernel.pointer("apps.alias", "apps.demo").unwrap();

    assert_eq!(kernel.read("apps.alias.title"), Some(&Value::from("Demo")));
    assert_eq!(kernel.read("apps.alias.count"), Some(&Value::from(2_u64)));
}

#[test]
fn pointer_reads_target_live_value_after_overwrite() {
    let mut kernel = Kernel::new();

    kernel.postulate("apps.demo.title", "Before").unwrap();
    kernel
        .pointer("apps.alias.title", "apps.demo.title")
        .unwrap();
    kernel.postulate("apps.demo.title", "After").unwrap();

    assert_eq!(kernel.read("apps.alias.title"), Some(&Value::from("After")));
}

#[test]
fn pointer_cycles_fail_closed() {
    let mut kernel = Kernel::new();

    kernel.pointer("apps.a", "apps.b").unwrap();
    kernel.pointer("apps.b", "apps.a").unwrap();

    assert_eq!(kernel.read("apps.a"), None);
    assert_eq!(kernel.read("apps.b"), None);
}

#[test]
fn pointer_replays_through_snapshot_hydration() {
    let mut kernel = Kernel::new();

    kernel.postulate("apps.demo.title", "Demo").unwrap();
    kernel.pointer("apps.alias", "apps.demo").unwrap();

    let restored = Kernel::hydrate(kernel.export_snapshot()).unwrap();

    assert_eq!(restored.memories(), kernel.memories());
    assert_eq!(
        restored.read("apps.alias.title"),
        Some(&Value::from("Demo"))
    );
}
