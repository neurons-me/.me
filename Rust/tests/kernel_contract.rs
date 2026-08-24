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

#[test]
fn root_identity_claim_sets_active_identity() {
    let mut kernel = Kernel::new();

    let memory = kernel.claim_identity(" Jabellae ").unwrap().clone();

    assert_eq!(kernel.active_identity(), Some("jabellae"));
    assert_eq!(memory.path, Vec::<String>::new());
    assert_eq!(memory.operator.as_deref(), Some("@"));
    assert_eq!(memory.value, Value::Identity("jabellae".to_string()));
    assert_eq!(
        kernel.read(""),
        Some(&Value::Identity("jabellae".to_string()))
    );
}

#[test]
fn scoped_identity_writes_marker_without_replacing_active_identity() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    let memory = kernel
        .identity("profile.owner", "Worker-01")
        .unwrap()
        .clone();

    assert_eq!(kernel.active_identity(), Some("jabellae"));
    assert_eq!(
        memory.path,
        vec!["profile".to_string(), "owner".to_string(),]
    );
    assert_eq!(memory.operator.as_deref(), Some("@"));
    assert_eq!(memory.value, Value::Identity("worker-01".to_string()));
    assert_eq!(
        kernel.read("profile.owner"),
        Some(&Value::Identity("worker-01".to_string()))
    );
}

#[test]
fn identity_claim_rejects_invalid_labels() {
    let mut kernel = Kernel::new();

    assert!(matches!(
        kernel.claim_identity("ab"),
        Err(KernelError::InvalidIdentity(_))
    ));
    assert!(matches!(
        kernel.claim_identity("bad.name"),
        Err(KernelError::InvalidIdentity(_))
    ));
    assert!(matches!(
        kernel.claim_identity("-bad"),
        Err(KernelError::InvalidIdentity(_))
    ));
    assert_eq!(kernel.active_identity(), None);
    assert_eq!(kernel.memories().len(), 0);
}

#[test]
fn root_identity_replays_through_snapshot_hydration() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    kernel.identity("profile.owner", "worker").unwrap();

    let restored = Kernel::hydrate(kernel.export_snapshot()).unwrap();

    assert_eq!(restored.memories(), kernel.memories());
    assert_eq!(restored.active_identity(), Some("jabellae"));
    assert_eq!(
        restored.read("profile.owner"),
        Some(&Value::Identity("worker".to_string()))
    );
}

#[test]
fn collect_returns_values_without_committing_memory() {
    let mut kernel = Kernel::new();

    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.postulate("profile.city", "Veracruz").unwrap();

    let values = kernel
        .collect(["profile.name", "profile.city"])
        .expect("collect should read values");

    assert_eq!(
        values,
        Value::Array(vec![Value::from("Abella"), Value::from("Veracruz")])
    );
    assert_eq!(kernel.memories().len(), 2);
}

#[test]
fn query_commits_collect_memory_at_target_path() {
    let mut kernel = Kernel::new();

    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.postulate("profile.city", "Veracruz").unwrap();
    let memory = kernel
        .query("profile.summary", ["profile.name", "profile.city"])
        .unwrap()
        .clone();

    assert_eq!(memory.operator.as_deref(), Some("?"));
    assert_eq!(
        memory.value,
        Value::Array(vec![Value::from("Abella"), Value::from("Veracruz")])
    );
    assert_eq!(
        kernel.read("profile.summary"),
        Some(&Value::Array(vec![
            Value::from("Abella"),
            Value::from("Veracruz")
        ]))
    );
}

#[test]
fn query_single_segment_paths_are_relative_to_target_scope() {
    let mut kernel = Kernel::new();

    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.postulate("profile.city", "Veracruz").unwrap();
    kernel.query("profile", ["name", "city"]).unwrap();

    assert_eq!(
        kernel.read("profile"),
        Some(&Value::Array(vec![
            Value::from("Abella"),
            Value::from("Veracruz")
        ]))
    );
}

#[test]
fn query_missing_paths_are_null() {
    let mut kernel = Kernel::new();

    kernel.postulate("profile.name", "Abella").unwrap();
    kernel
        .query("profile.summary", ["profile.name", "profile.age"])
        .unwrap();

    assert_eq!(
        kernel.read("profile.summary"),
        Some(&Value::Array(vec![Value::from("Abella"), Value::Null]))
    );
}

#[test]
fn query_under_secret_scope_stays_out_of_public_index() {
    let mut kernel = Kernel::new();

    kernel.secret("profile", "alpha").unwrap();
    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.postulate("profile.city", "Veracruz").unwrap();
    let memory = kernel.query("profile", ["name", "city"]).unwrap().clone();

    assert_eq!(memory.operator.as_deref(), Some("?"));
    assert_eq!(
        kernel.read("profile"),
        Some(&Value::Array(vec![
            Value::from("Abella"),
            Value::from("Veracruz")
        ]))
    );
    assert_eq!(kernel.read_public("profile"), None);
    assert_eq!(kernel.read_public("profile.name"), None);
}

#[test]
fn query_replays_through_snapshot_hydration() {
    let mut kernel = Kernel::new();

    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.postulate("profile.city", "Veracruz").unwrap();
    kernel
        .query("profile.summary", ["profile.name", "profile.city"])
        .unwrap();

    let restored = Kernel::hydrate(kernel.export_snapshot()).unwrap();

    assert_eq!(restored.memories(), kernel.memories());
    assert_eq!(
        restored.read("profile.summary"),
        Some(&Value::Array(vec![
            Value::from("Abella"),
            Value::from("Veracruz")
        ]))
    );
}

#[test]
fn empty_query_is_rejected() {
    let mut kernel = Kernel::new();

    let error = kernel
        .query("profile.summary", Vec::<&str>::new())
        .expect_err("empty query should be rejected");

    assert_eq!(error, KernelError::EmptyQuery);
    assert_eq!(kernel.memories().len(), 0);
}

#[test]
fn derivation_computes_from_relative_scope() {
    let mut kernel = Kernel::new();

    kernel.postulate("order.price", 10_u64).unwrap();
    kernel.postulate("order.quantity", 3_u64).unwrap();
    let memory = kernel
        .derive("order", "total", "price * quantity")
        .unwrap()
        .clone();

    assert_eq!(memory.operator.as_deref(), Some("="));
    assert_eq!(memory.expression.as_deref(), Some("price * quantity"));
    assert_eq!(memory.path, vec!["order".to_string(), "total".to_string()]);
    assert_eq!(memory.value, Value::from(30_f64));
    assert_eq!(kernel.read("order.total"), Some(&Value::from(30_f64)));
}

#[test]
fn derivation_recomputes_when_dependency_changes() {
    let mut kernel = Kernel::new();

    kernel.postulate("order.price", 10_u64).unwrap();
    kernel.postulate("order.quantity", 3_u64).unwrap();
    kernel.derive("order", "total", "price * quantity").unwrap();
    kernel.postulate("order.price", 12_u64).unwrap();

    assert_eq!(kernel.read("order.total"), Some(&Value::from(36_f64)));
    assert_eq!(
        kernel.memories().last().unwrap().operator.as_deref(),
        Some("=")
    );
    assert_eq!(
        kernel.memories().last().unwrap().expression.as_deref(),
        Some("price * quantity")
    );
}

#[test]
fn derivations_cascade_through_derived_refs() {
    let mut kernel = Kernel::new();

    kernel.postulate("price", 10_u64).unwrap();
    kernel.derive("", "cost_a", "price * 2").unwrap();
    kernel.derive("", "total", "cost_a + 5").unwrap();

    assert_eq!(kernel.read("total"), Some(&Value::from(25_f64)));

    kernel.postulate("price", 20_u64).unwrap();

    assert_eq!(kernel.read("cost_a"), Some(&Value::from(40_f64)));
    assert_eq!(kernel.read("total"), Some(&Value::from(45_f64)));
}

#[test]
fn unresolved_derivation_stores_expression_until_inputs_exist() {
    let mut kernel = Kernel::new();

    kernel.derive("order", "total", "price * quantity").unwrap();

    assert_eq!(
        kernel.read("order.total"),
        Some(&Value::from("price * quantity"))
    );

    kernel.postulate("order.price", 10_u64).unwrap();
    assert_eq!(
        kernel.read("order.total"),
        Some(&Value::from("price * quantity"))
    );

    kernel.postulate("order.quantity", 2_u64).unwrap();
    assert_eq!(kernel.read("order.total"), Some(&Value::from(20_f64)));
}

#[test]
fn derivation_supports_boolean_expressions() {
    let mut kernel = Kernel::new();

    kernel.postulate("district.currentLoad", 90_u64).unwrap();
    kernel.postulate("district.capacity", 100_u64).unwrap();
    kernel
        .derive(
            "district",
            "needsRedirection",
            "currentLoad / capacity * 100 > 85",
        )
        .unwrap();

    assert_eq!(
        kernel.read("district.needsRedirection"),
        Some(&Value::from(true))
    );

    kernel.postulate("district.currentLoad", 70_u64).unwrap();

    assert_eq!(
        kernel.read("district.needsRedirection"),
        Some(&Value::from(false))
    );
}

#[test]
fn derivation_replays_through_snapshot_hydration() {
    let mut kernel = Kernel::new();

    kernel.postulate("order.price", 10_u64).unwrap();
    kernel.postulate("order.quantity", 3_u64).unwrap();
    kernel.derive("order", "total", "price * quantity").unwrap();

    let mut restored = Kernel::hydrate(kernel.export_snapshot()).unwrap();

    assert_eq!(restored.memories(), kernel.memories());
    assert_eq!(restored.read("order.total"), Some(&Value::from(30_f64)));

    restored.postulate("order.quantity", 4_u64).unwrap();

    assert_eq!(restored.read("order.total"), Some(&Value::from(40_f64)));
}

#[test]
fn hydration_rejects_tampered_derivation_expression() {
    let mut kernel = Kernel::new();

    kernel.postulate("order.price", 10_u64).unwrap();
    kernel.postulate("order.quantity", 3_u64).unwrap();
    kernel.derive("order", "total", "price * quantity").unwrap();

    let mut snapshot = kernel.export_snapshot();
    snapshot.memories[2].expression = Some("price + quantity".to_string());

    let error = Kernel::hydrate(snapshot).expect_err("tampering must be detected");

    assert!(matches!(
        error,
        KernelError::HydrationHashMismatch {
            path,
            expected: _,
            actual: _
        } if path == vec!["order".to_string(), "total".to_string()]
    ));
}

#[test]
fn secret_scope_hides_existing_branch_from_public_index() {
    let mut kernel = Kernel::new();

    kernel.postulate("wallet.balance", 100_u64).unwrap();
    let memory = kernel.secret("wallet", "vault-key").unwrap().clone();

    assert_eq!(memory.operator.as_deref(), Some("_"));
    assert_eq!(memory.path, vec!["wallet".to_string()]);
    assert_eq!(memory.value, Value::from("***"));
    assert!(kernel.is_secret_scope("wallet"));
    assert_eq!(kernel.read("wallet.balance"), Some(&Value::from(100_u64)));
    assert_eq!(kernel.read_public("wallet.balance"), None);
}

#[test]
fn writes_under_secret_scope_stay_out_of_public_index() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "vault-key").unwrap();
    kernel.postulate("wallet.balance", 100_u64).unwrap();
    kernel.postulate("profile.name", "Jabellae").unwrap();

    assert_eq!(kernel.read("wallet.balance"), Some(&Value::from(100_u64)));
    assert_eq!(kernel.read_public("wallet.balance"), None);
    assert_eq!(
        kernel.read_public("profile.name"),
        Some(&Value::from("Jabellae"))
    );
}

#[test]
fn secret_scope_does_not_hide_siblings() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "vault-key").unwrap();
    kernel.postulate("wallet.balance", 100_u64).unwrap();
    kernel.postulate("wallets.balance", 200_u64).unwrap();

    assert_eq!(kernel.read_public("wallet.balance"), None);
    assert_eq!(
        kernel.read_public("wallets.balance"),
        Some(&Value::from(200_u64))
    );
}

#[test]
fn remove_secret_scope_clears_private_data_and_scope() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "vault-key").unwrap();
    kernel.postulate("wallet.balance", 100_u64).unwrap();
    kernel.remove("wallet").unwrap();

    assert_eq!(kernel.read("wallet.balance"), None);
    assert_eq!(kernel.read_public("wallet.balance"), None);
    assert!(!kernel.is_secret_scope("wallet"));

    kernel.postulate("wallet.balance", 200_u64).unwrap();
    assert_eq!(
        kernel.read_public("wallet.balance"),
        Some(&Value::from(200_u64))
    );
}

#[test]
fn secret_scope_replays_through_snapshot_hydration() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "vault-key").unwrap();
    kernel.postulate("wallet.balance", 100_u64).unwrap();
    kernel.postulate("profile.name", "Jabellae").unwrap();

    let restored = Kernel::hydrate(kernel.export_snapshot()).unwrap();

    assert_eq!(restored.memories(), kernel.memories());
    assert!(restored.is_secret_scope("wallet"));
    assert_eq!(restored.read("wallet.balance"), Some(&Value::from(100_u64)));
    assert_eq!(restored.read_public("wallet.balance"), None);
    assert_eq!(
        restored.read_public("profile.name"),
        Some(&Value::from("Jabellae"))
    );
}

#[test]
fn empty_secret_is_rejected() {
    let mut kernel = Kernel::new();

    let error = kernel
        .secret("wallet", "   ")
        .expect_err("empty secret should be rejected");

    assert_eq!(error, KernelError::EmptySecret);
    assert!(!kernel.is_secret_scope("wallet"));
    assert_eq!(kernel.memories().len(), 0);
}
