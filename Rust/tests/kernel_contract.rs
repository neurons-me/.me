use this_me::kernel::{
    ExplainOrigin, Kernel, KernelError, SecretMaterialMode, SecretMaterialPurpose, Value,
};

fn hex(bytes: impl AsRef<[u8]>) -> String {
    bytes
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

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
fn memory_hash_uses_portable_fnv1a_chain() {
    let mut kernel = Kernel::new();

    kernel.postulate("apps.demo.count", 1_u64).unwrap();
    kernel.postulate("apps.demo.count", 2_u64).unwrap();

    assert_eq!(kernel.memories()[0].hash, "0e5304b1");
    assert_eq!(kernel.memories()[0].prev_hash, None);
    assert_eq!(kernel.memories()[1].hash, "e33eb2e6");
    assert_eq!(kernel.memories()[1].prev_hash, Some("0e5304b1".to_string()));
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
fn inspect_reports_public_kernel_shape() {
    let mut kernel = Kernel::new();

    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.noise("wallet", "noise-A").unwrap();
    kernel.postulate("order.price", 10_u64).unwrap();
    kernel.postulate("order.quantity", 3_u64).unwrap();
    kernel.derive("order", "total", "price * quantity").unwrap();

    let inspect = kernel.inspect();

    assert_eq!(inspect.memories.len(), kernel.memories().len());
    assert_eq!(
        inspect
            .index
            .get(&vec!["profile".to_string(), "name".to_string()]),
        Some(&Value::from("Abella"))
    );
    assert_eq!(inspect.noise_scopes, vec![vec!["wallet".to_string()]]);
    assert_eq!(
        inspect.derivations,
        vec![vec!["order".to_string(), "total".to_string()]]
    );
}

#[test]
fn inspect_last_returns_tail_memories_only() {
    let mut kernel = Kernel::new();

    kernel.postulate("a", 1_u64).unwrap();
    kernel.postulate("b", 2_u64).unwrap();
    kernel.postulate("c", 3_u64).unwrap();

    let inspect = kernel.inspect_last(2);

    assert_eq!(inspect.memories.len(), 2);
    assert_eq!(inspect.memories[0].path, vec!["b".to_string()]);
    assert_eq!(inspect.memories[1].path, vec!["c".to_string()]);
}

#[test]
fn inspect_redacts_memories_under_secret_scope() {
    let mut kernel = Kernel::new();

    kernel.postulate("wallet.balance", 100_u64).unwrap();
    kernel.secret("wallet", "alpha").unwrap();
    kernel.postulate("wallet.note", "private").unwrap();

    let inspect = kernel.inspect();
    let balance = inspect
        .memories
        .iter()
        .find(|memory| memory.path == vec!["wallet".to_string(), "balance".to_string()])
        .expect("balance memory should remain observable");
    let note = inspect
        .memories
        .iter()
        .find(|memory| memory.path == vec!["wallet".to_string(), "note".to_string()])
        .expect("note memory should remain observable");

    assert_eq!(inspect.secret_scopes, vec![vec!["wallet".to_string()]]);
    assert_eq!(balance.value, Value::from("****"));
    assert_eq!(note.value, Value::from("****"));
    assert_eq!(
        inspect
            .index
            .get(&vec!["wallet".to_string(), "balance".to_string()]),
        None
    );
}

#[test]
fn inspect_does_not_redact_owner_snapshot() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "alpha").unwrap();
    kernel.postulate("wallet.note", "private").unwrap();

    let snapshot = kernel.export_snapshot();
    let inspect = kernel.inspect();

    assert_eq!(snapshot.memories[1].value, Value::from("private"));
    assert_eq!(inspect.memories[1].value, Value::from("****"));
}

#[test]
fn explain_plain_path_reports_value_without_derivation() {
    let mut kernel = Kernel::new();

    kernel.postulate("profile.name", "Abella").unwrap();

    let explanation = kernel.explain("profile.name").unwrap();

    assert_eq!(
        explanation.path,
        vec!["profile".to_string(), "name".to_string()]
    );
    assert_eq!(explanation.value, Some(Value::from("Abella")));
    assert_eq!(explanation.expr, None);
    assert_eq!(explanation.derivation, None);
    assert_eq!(explanation.meta.depends_on, Vec::<Vec<String>>::new());
    assert_eq!(
        explanation.meta.resolved_path,
        vec!["profile".to_string(), "name".to_string()]
    );
    assert_eq!(explanation.meta.pointer_chain, Vec::<Vec<String>>::new());
    assert!(!explanation.meta.secret);
}

#[test]
fn explain_derivation_reports_expression_inputs_and_dependencies() {
    let mut kernel = Kernel::new();

    kernel.postulate("order.price", 10_u64).unwrap();
    kernel.postulate("order.quantity", 3_u64).unwrap();
    kernel.derive("order", "total", "price * quantity").unwrap();

    let explanation = kernel.explain("order.total").unwrap();
    let derivation = explanation.derivation.unwrap();

    assert_eq!(explanation.value, Some(Value::from(30_f64)));
    assert_eq!(explanation.expr.as_deref(), Some("price * quantity"));
    assert_eq!(derivation.expression, "price * quantity");
    assert_eq!(
        explanation.meta.depends_on,
        vec![
            vec!["order".to_string(), "price".to_string()],
            vec!["order".to_string(), "quantity".to_string()],
        ]
    );
    assert_eq!(derivation.inputs.len(), 2);
    assert_eq!(derivation.inputs[0].label, "price");
    assert_eq!(
        derivation.inputs[0].path,
        vec!["order".to_string(), "price".to_string()]
    );
    assert_eq!(derivation.inputs[0].value, Some(Value::from(10_u64)));
    assert_eq!(derivation.inputs[0].origin, ExplainOrigin::Public);
    assert!(!derivation.inputs[0].masked);
}

#[test]
fn explain_pointer_reports_resolved_path_and_chain() {
    let mut kernel = Kernel::new();

    kernel.postulate("wallet.balance", 100_u64).unwrap();
    kernel.pointer("profile.card", "wallet").unwrap();

    let explanation = kernel.explain("profile.card.balance").unwrap();

    assert_eq!(explanation.value, Some(Value::from(100_u64)));
    assert_eq!(
        explanation.meta.resolved_path,
        vec!["wallet".to_string(), "balance".to_string()]
    );
    assert_eq!(
        explanation.meta.pointer_chain,
        vec![vec!["profile".to_string(), "card".to_string()]]
    );
}

#[test]
fn explain_masks_secret_derivation_inputs() {
    let mut kernel = Kernel::new();

    kernel.postulate("pub.base", 10_u64).unwrap();
    kernel.secret("secure", "alpha").unwrap();
    kernel.postulate("secure.rate", 2_u64).unwrap();
    kernel.derive("pub", "score", "base * secure.rate").unwrap();

    let explanation = kernel.explain("pub.score").unwrap();
    let derivation = explanation.derivation.unwrap();
    let secret_input = derivation
        .inputs
        .iter()
        .find(|input| input.path == vec!["secure".to_string(), "rate".to_string()])
        .expect("secret input should be reported");

    assert_eq!(explanation.value, Some(Value::from(20_f64)));
    assert_eq!(secret_input.label, "secure.rate");
    assert_eq!(secret_input.value, Some(Value::from("****")));
    assert_eq!(secret_input.origin, ExplainOrigin::Secret);
    assert!(secret_input.masked);
}

#[test]
fn explain_secret_path_marks_result_secret() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "alpha").unwrap();
    kernel.postulate("wallet.balance", 100_u64).unwrap();

    let explanation = kernel.explain("wallet.balance").unwrap();

    assert_eq!(explanation.value, Some(Value::from(100_u64)));
    assert!(explanation.meta.secret);
}

#[test]
fn noise_scope_records_redacted_boundary_memory() {
    let mut kernel = Kernel::new();

    let memory = kernel.noise("wallet", "noise-A").unwrap().clone();

    assert_eq!(memory.operator.as_deref(), Some("~"));
    assert_eq!(memory.path, vec!["wallet".to_string()]);
    assert_eq!(memory.value, Value::from("***"));
    assert!(kernel.is_noise_scope("wallet"));
    assert_eq!(kernel.read("wallet"), None);
    assert_eq!(kernel.read_public("wallet"), None);
}

#[test]
fn noise_scope_does_not_hide_public_descendants_by_itself() {
    let mut kernel = Kernel::new();

    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.noise("profile", "noise-A").unwrap();
    kernel.postulate("profile.city", "Veracruz").unwrap();

    assert!(kernel.is_noise_scope("profile"));
    assert_eq!(kernel.read("profile.name"), Some(&Value::from("Abella")));
    assert_eq!(
        kernel.read_public("profile.city"),
        Some(&Value::from("Veracruz"))
    );
}

#[test]
fn noise_under_secret_scope_keeps_public_view_closed() {
    let mut kernel = Kernel::new();

    kernel.secret("profile", "alpha").unwrap();
    kernel.noise("profile", "noise-A").unwrap();
    kernel.postulate("profile.name", "Abella").unwrap();

    assert!(kernel.is_secret_scope("profile"));
    assert!(kernel.is_noise_scope("profile"));
    assert_eq!(kernel.read("profile.name"), Some(&Value::from("Abella")));
    assert_eq!(kernel.read_public("profile.name"), None);
}

#[test]
fn noise_boundary_restarts_seed_then_applies_allowed_secrets() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "alpha").unwrap();
    kernel
        .postulate("wallet.hidden.notes", "alpha-note")
        .unwrap();
    kernel.noise("wallet", "noise-A").unwrap();
    kernel.secret("wallet.hidden", "beta").unwrap();
    kernel.postulate("wallet.hidden.seed", "beta-seed").unwrap();

    assert_eq!(
        kernel.effective_secret("wallet.hidden.seed").unwrap(),
        "36788adc"
    );
}

#[test]
fn secret_material_v3_includes_active_noise_boundary() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "alpha").unwrap();
    kernel
        .postulate("wallet.hidden.notes", "alpha-note")
        .unwrap();
    kernel.noise("wallet", "noise-A").unwrap();
    kernel.secret("wallet.hidden", "beta").unwrap();
    kernel.postulate("wallet.hidden.seed", "beta-seed").unwrap();

    let material = kernel
        .secret_material_v3(
            "wallet.hidden.seed",
            SecretMaterialMode::Value,
            SecretMaterialPurpose::Value,
        )
        .unwrap();

    assert_eq!(
        hex(material),
        "6d1fee023186ae05ce3797b69ae0a65f0ba933ed9c52755312306539768cb684"
    );
}

#[test]
fn remove_noise_scope_clears_boundary() {
    let mut kernel = Kernel::new();

    kernel.noise("profile", "noise-A").unwrap();
    kernel.remove("profile").unwrap();

    assert!(!kernel.is_noise_scope("profile"));
    kernel.postulate("profile.name", "Abella").unwrap();
    assert_eq!(
        kernel.read_public("profile.name"),
        Some(&Value::from("Abella"))
    );
}

#[test]
fn noise_scope_replays_through_snapshot_hydration() {
    let mut kernel = Kernel::new();

    kernel.noise("wallet", "noise-A").unwrap();
    kernel.postulate("wallet.balance", 100_u64).unwrap();

    let restored = Kernel::hydrate(kernel.export_snapshot()).unwrap();

    assert_eq!(restored.memories(), kernel.memories());
    assert!(restored.is_noise_scope("wallet"));
    assert_eq!(
        restored.read_public("wallet.balance"),
        Some(&Value::from(100_u64))
    );
}

#[test]
fn empty_noise_is_rejected() {
    let mut kernel = Kernel::new();

    let error = kernel
        .noise("wallet", "   ")
        .expect_err("empty noise should be rejected");

    assert_eq!(error, KernelError::EmptyNoise);
    assert!(!kernel.is_noise_scope("wallet"));
    assert_eq!(kernel.memories().len(), 0);
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
fn effective_secret_follows_secret_lineage() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "alpha").unwrap();
    kernel.postulate("wallet.balance", 100_u64).unwrap();
    kernel.secret("wallet.hidden", "beta").unwrap();
    kernel.postulate("wallet.hidden.seed", "beta-seed").unwrap();

    assert_eq!(
        kernel.effective_secret("wallet.balance").unwrap(),
        "9d3ce45b"
    );
    assert_eq!(
        kernel.effective_secret("wallet.hidden.seed").unwrap(),
        "f11aeb12"
    );
    assert_eq!(kernel.memories()[0].hash, "4393708b");
    assert_eq!(kernel.memories()[1].hash, "65ecdd30");
}

#[test]
fn secret_material_v3_matches_typescript_branch_and_value_fixtures() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "steel-door").unwrap();
    kernel.postulate("wallet.balance", 100_u64).unwrap();
    kernel.postulate("wallet.note", "private").unwrap();

    let branch = kernel
        .secret_material_v3(
            "wallet.balance",
            SecretMaterialMode::Branch,
            SecretMaterialPurpose::Branch,
        )
        .unwrap();
    let value_balance = kernel
        .secret_material_v3(
            "wallet.balance",
            SecretMaterialMode::Value,
            SecretMaterialPurpose::Value,
        )
        .unwrap();
    let value_note = kernel
        .secret_material_v3(
            "wallet.note",
            SecretMaterialMode::Value,
            SecretMaterialPurpose::Value,
        )
        .unwrap();

    assert_eq!(
        hex(branch),
        "61a15d8d2c2b154bb965c9691876896b87a4e371b7fbdfb33be87a58bc56a25f"
    );
    assert_eq!(
        hex(value_balance),
        "c46935fc5b433940203756a537b56e88dc51bb711fceb21b3490343f95cdd2cb"
    );
    assert_eq!(
        hex(value_note),
        "0ba0895e0c51bd759ebc78552855137ebf7c0e608e5494942793f2dc445756a9"
    );
    assert_ne!(value_balance, value_note);
}

#[test]
fn blob_v3_keys_match_typescript_fixtures() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "steel-door").unwrap();
    kernel.postulate("wallet.balance", 100_u64).unwrap();

    let branch_keys = kernel
        .secret_blob_keys_v3("wallet.balance", SecretMaterialMode::Branch)
        .unwrap();
    let value_keys = kernel
        .secret_blob_keys_v3("wallet.balance", SecretMaterialMode::Value)
        .unwrap();

    assert_eq!(
        hex(&branch_keys.path_context),
        "77616c6c65742e62616c616e6365"
    );
    assert_eq!(
        hex(branch_keys.enc_key),
        "d6c083de386973b96784c94708996945e4b6ce49d2c2f4c24b51be96b6c13f71"
    );
    assert_eq!(
        hex(branch_keys.mac_key),
        "925244047426e98be206dd29dec81cd05bb98e9a4d4d660b8c52c5f16d3f8f4f"
    );

    assert_eq!(
        hex(&value_keys.path_context),
        "77616c6c65742e62616c616e6365"
    );
    assert_eq!(
        hex(value_keys.enc_key),
        "80938b1df755f88cd88ce4170856658bea69d8ce8e611f2fdf26d4e22b0b57ab"
    );
    assert_eq!(
        hex(value_keys.mac_key),
        "966dde6a725fbec96a16e324003b60af6ce14da2a8677c8cd91e40a93c09957c"
    );
}

#[test]
fn encrypt_blob_v3_matches_typescript_fixture_and_decrypts() {
    let mut kernel = Kernel::new();
    let nonce = [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
        0x0f,
    ];

    kernel.secret("wallet", "steel-door").unwrap();
    kernel.postulate("wallet.balance", 100_u64).unwrap();

    let blob = kernel
        .encrypt_secret_value_v3("wallet.balance", 100_u64, nonce)
        .unwrap();

    assert_eq!(
        blob,
        "b64u:_m1lAwABAgMEBQYHCAkKCwwNDg96n3ivJyFIHd924OaJDs29P14O"
    );
    assert_eq!(
        kernel
            .decrypt_secret_value_v3("wallet.balance", &blob)
            .unwrap(),
        Some(Value::from(100_u64))
    );
}

#[test]
fn decrypt_blob_v3_tampering_fails_closed() {
    let mut kernel = Kernel::new();
    let nonce = [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
        0x0f,
    ];

    kernel.secret("wallet", "steel-door").unwrap();
    let mut blob = kernel
        .encrypt_secret_value_v3("wallet.balance", 100_u64, nonce)
        .unwrap();
    blob.pop();
    blob.push('A');

    assert_eq!(
        kernel
            .decrypt_secret_value_v3("wallet.balance", &blob)
            .unwrap(),
        None
    );
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
fn owner_snapshot_preserves_secret_material_for_hydration() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "alpha").unwrap();
    kernel.noise("wallet.hidden", "noise-A").unwrap();
    kernel.secret("wallet.hidden", "beta").unwrap();
    kernel.postulate("wallet.hidden.seed", "beta-seed").unwrap();

    let restored = Kernel::hydrate(kernel.export_snapshot()).unwrap();

    assert_eq!(
        restored.effective_secret("wallet.hidden.seed").unwrap(),
        kernel.effective_secret("wallet.hidden.seed").unwrap()
    );
    assert_eq!(
        restored.read("wallet.hidden.seed"),
        Some(&Value::from("beta-seed"))
    );
}

#[test]
fn hydration_rejects_tampered_secret_material() {
    let mut kernel = Kernel::new();

    kernel.secret("wallet", "alpha").unwrap();
    kernel.postulate("wallet.balance", 100_u64).unwrap();
    let mut snapshot = kernel.export_snapshot();
    snapshot
        .local_secrets
        .insert(vec!["wallet".to_string()], "gamma".to_string());

    let error = Kernel::hydrate(snapshot).expect_err("secret material tampering must fail");

    assert!(matches!(
        error,
        KernelError::HydrationHashMismatch {
            path,
            expected: _,
            actual: _
        } if path == vec!["wallet".to_string(), "balance".to_string()]
    ));
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
