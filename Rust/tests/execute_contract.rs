use this_me::kernel::{ExecuteError, ExecuteValue, Kernel, RecomputeMode, Value};

#[test]
fn self_targets_execute_locally_inside_kernel() {
    let mut kernel = Kernel::new();
    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.postulate("wallet.income", 1_000_u64).unwrap();
    kernel.postulate("wallet.expenses.rent", 500_u64).unwrap();
    kernel
        .derive(
            "",
            "wallet.netWorth",
            "wallet.income - wallet.expenses.rent",
        )
        .unwrap();

    assert_eq!(
        kernel.execute("me://self:read/profile.name", None).unwrap(),
        ExecuteValue::Value(Value::from("Abella"))
    );

    assert_eq!(
        kernel
            .execute("me://self:write/profile.city", Some("Veracruz".into()))
            .unwrap(),
        ExecuteValue::Value(Value::from("Veracruz"))
    );
    assert_eq!(kernel.read("profile.city"), Some(&Value::from("Veracruz")));

    let ExecuteValue::Inspect(scoped_inspect) =
        kernel.execute("me://self:inspect/profile", None).unwrap()
    else {
        panic!("self:inspect should return an inspect result");
    };
    assert_eq!(
        scoped_inspect
            .index
            .get(&vec!["profile".into(), "name".into()]),
        Some(&Value::from("Abella"))
    );
    assert_eq!(
        scoped_inspect
            .index
            .get(&vec!["profile".into(), "city".into()]),
        Some(&Value::from("Veracruz"))
    );
    assert!(!scoped_inspect
        .index
        .contains_key(&vec!["wallet".into(), "income".into()]));

    let ExecuteValue::Explain(explained) = kernel
        .execute_ast(
            this_me::kernel::MeTargetAst {
                scheme: "me".to_string(),
                namespace: "self".to_string(),
                operation: "explain".to_string(),
                path: "wallet.netWorth".to_string(),
                raw: None,
                context_raw: None,
            },
            None,
        )
        .unwrap()
    else {
        panic!("self:explain should return an explain result");
    };
    assert_eq!(explained.value, Some(Value::from(500_u64)));
    assert_eq!(
        explained.meta.depends_on,
        vec![
            vec![
                "wallet".to_string(),
                "expenses".to_string(),
                "rent".to_string()
            ],
            vec!["wallet".to_string(), "income".to_string()],
        ]
    );
}

#[test]
fn slash_paths_normalize_like_typescript_execute_paths() {
    let mut kernel = Kernel::new();

    kernel
        .execute("me://self:write/profile/name", Some("Dispatch".into()))
        .unwrap();

    assert_eq!(
        kernel.execute("me://self:read/profile.name", None).unwrap(),
        ExecuteValue::Value(Value::from("Dispatch"))
    );
    assert_eq!(
        kernel.execute("me://self:read/profile/name", None).unwrap(),
        ExecuteValue::Value(Value::from("Dispatch"))
    );
}

#[test]
fn kernel_targets_expose_memory_snapshots_and_mode_control() {
    let mut kernel = Kernel::new();
    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.postulate("profile.city", "Veracruz").unwrap();

    let ExecuteValue::Memories(memory_log) =
        kernel.execute("me://kernel:read/memory", None).unwrap()
    else {
        panic!("kernel:read/memory should return memories");
    };
    assert!(memory_log.len() >= 2);

    let ExecuteValue::Snapshot(exported_snapshot) =
        kernel.execute("me://kernel:export/snapshot", None).unwrap()
    else {
        panic!("kernel:export/snapshot should return a snapshot");
    };
    assert_eq!(exported_snapshot.memories.len(), memory_log.len());

    assert_eq!(
        kernel
            .execute("me://kernel:get/recompute.mode", None)
            .unwrap(),
        ExecuteValue::Mode(RecomputeMode::Eager)
    );
    assert_eq!(
        kernel
            .execute("me://kernel:set/recompute.mode", Some("lazy".into()))
            .unwrap(),
        ExecuteValue::Mode(RecomputeMode::Lazy)
    );
    assert_eq!(
        kernel.execute("me://kernel:get/mode", None).unwrap(),
        ExecuteValue::Mode(RecomputeMode::Lazy)
    );
    assert_eq!(
        kernel
            .execute("me://kernel:read/recompute.mode", None)
            .unwrap(),
        ExecuteValue::Mode(RecomputeMode::Lazy)
    );
}

#[test]
fn snapshot_import_and_memory_replay_reconstruct_state() {
    let mut kernel = Kernel::new();
    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.postulate("profile.city", "Veracruz").unwrap();
    kernel.postulate("wallet.income", 1_000_u64).unwrap();
    kernel.postulate("wallet.expenses.rent", 500_u64).unwrap();
    kernel
        .derive(
            "",
            "wallet.netWorth",
            "wallet.income - wallet.expenses.rent",
        )
        .unwrap();

    let ExecuteValue::Snapshot(snapshot) =
        kernel.execute("me://kernel:export/snapshot", None).unwrap()
    else {
        panic!("kernel:export/snapshot should return a snapshot");
    };
    let ExecuteValue::Memories(memory_log) =
        kernel.execute("me://kernel:export/memory", None).unwrap()
    else {
        panic!("kernel:export/memory should return memories");
    };

    let mut hydrated = Kernel::new();
    hydrated
        .execute(
            "me://kernel:hydrate/snapshot",
            Some(ExecuteValue::Snapshot(snapshot.clone())),
        )
        .unwrap();
    assert_eq!(hydrated.read("profile.name"), Some(&Value::from("Abella")));
    assert_eq!(
        hydrated.read("profile.city"),
        Some(&Value::from("Veracruz"))
    );

    let mut imported = Kernel::new();
    imported
        .execute(
            "me://kernel:import/snapshot",
            Some(ExecuteValue::Snapshot(snapshot)),
        )
        .unwrap();
    assert_eq!(imported.read("profile.name"), Some(&Value::from("Abella")));

    let mut replayed = Kernel::new();
    replayed
        .execute(
            "me://kernel:replay/memory",
            Some(ExecuteValue::Memories(memory_log)),
        )
        .unwrap();
    assert_eq!(replayed.read("profile.name"), Some(&Value::from("Abella")));
    assert_eq!(
        replayed.read("wallet.netWorth"),
        Some(&Value::from(500_u64))
    );
}

#[test]
fn external_targets_stay_out_of_local_kernel() {
    let mut kernel = Kernel::new();

    let error = kernel
        .execute("me://ana.cleaker:read/profile", None)
        .unwrap_err();

    assert!(matches!(
        error,
        ExecuteError::UnsupportedNamespace(namespace) if namespace == "ana.cleaker"
    ));
}
