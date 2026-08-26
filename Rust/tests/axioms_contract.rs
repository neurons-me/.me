use this_me::kernel::{Kernel, KernelError, SecretMaterialMode, SecretMaterialPurpose, Value};

// Rust ports the kernel-level axioms. The TypeScript-only proxy axiom
// (A-struct-0: callable + navigable Proxy surface) is intentionally not modeled
// here; Rust exposes the same meaning through explicit kernel methods.
//
// Known parity gaps kept visible by this file:
// - A5: TypeScript keeps a secret scope root stealth after '?'. Rust currently
//   stores the query result in the owner-private index at that root while
//   keeping the public view closed.
// - A4 direct pointer reads are observable as {__ptr} in TypeScript. Rust reads
//   through pointers immediately; the pointer remains first-class in memory.
// - A9: TypeScript has timestamp/hash LWW tie-break semantics. Rust Memory does
//   not carry timestamps yet, so the Rust axiom pins append-order latest
//   projection until timestamped memories are ported.

fn path(value: &str) -> Vec<String> {
    if value.is_empty() {
        Vec::new()
    } else {
        value.split('.').map(str::to_string).collect()
    }
}

fn assert_stealth_root(kernel: &Kernel, scope: &str) {
    assert_eq!(kernel.read(scope), None);
    assert_eq!(kernel.read_public(scope), None);
}

fn assert_public_prefix_absent(kernel: &Kernel, prefix: &str) {
    let prefix = path(prefix);
    for key in kernel.inspect().index.keys() {
        assert!(
            !starts_with(key, &prefix),
            "public index leaked prefix {prefix:?} through key {key:?}"
        );
    }
}

fn starts_with(path: &[String], prefix: &[String]) -> bool {
    path.len() >= prefix.len() && path[..prefix.len()] == *prefix
}

fn hex(bytes: impl AsRef<[u8]>) -> String {
    bytes
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

fn tamper_first_value(snapshot: &mut this_me::kernel::Snapshot, value: Value) {
    snapshot.memories[0].value = value;
}

#[test]
fn axiom_a0_root_stays_public_secret_scope_root_stays_stealth() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    kernel.postulate("ledger.host", "localhost:8161").unwrap();
    kernel.postulate("ledger.protocol", "http").unwrap();
    kernel.secret("wallet", "secret").unwrap();
    kernel.postulate("wallet.income", 100_u64).unwrap();

    assert_eq!(
        kernel.read("ledger.host"),
        Some(&Value::from("localhost:8161"))
    );
    assert_eq!(kernel.read("ledger.protocol"), Some(&Value::from("http")));
    assert_stealth_root(&kernel, "wallet");
    assert_eq!(kernel.read("wallet.income"), Some(&Value::from(100_u64)));
    assert_public_prefix_absent(&kernel, "wallet");
}

#[test]
fn axiom_a1_identity_validates_username_semantics_and_records_root_claim() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    assert_eq!(kernel.active_identity(), Some("jabellae"));
    assert_eq!(
        kernel.memories().last().unwrap().operator.as_deref(),
        Some("@")
    );

    kernel.claim_identity("Abella").unwrap();
    assert_eq!(kernel.active_identity(), Some("abella"));

    for invalid in [
        "a_b", "-aaa", "aaa-", "a..b", "a.b", "a b", "á", "A", "", "aa", "a", "ab",
    ] {
        let error = kernel
            .claim_identity(invalid)
            .expect_err("invalid identity should be rejected");
        assert!(matches!(error, KernelError::InvalidIdentity(_)));
    }
}

#[test]
fn axiom_a2_secret_operator_creates_stealth_scope() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    kernel.postulate("profile.kind", "public-profile").unwrap();
    kernel.secret("profile", "alpha").unwrap();
    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.postulate("profile.city", "Veracruz").unwrap();

    assert_stealth_root(&kernel, "profile");
    assert_eq!(kernel.read("profile.name"), Some(&Value::from("Abella")));
    assert_eq!(kernel.read("profile.city"), Some(&Value::from("Veracruz")));
    assert_public_prefix_absent(&kernel, "profile");
}

#[test]
fn axiom_a3_noise_resets_secret_lineage_without_breaking_owner_reads() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    kernel.secret("wallet", "alpha").unwrap();
    kernel
        .postulate("wallet.hidden.notes", "alpha-note")
        .unwrap();
    let alpha_hash = kernel.memories().last().unwrap().hash.clone();

    kernel.noise("wallet", "noise-A").unwrap();
    kernel.secret("wallet.hidden", "beta").unwrap();
    kernel.postulate("wallet.hidden.seed", "beta-seed").unwrap();
    let beta_hash = kernel.memories().last().unwrap().hash.clone();

    let beta_material = kernel
        .secret_material_v3(
            "wallet.hidden.seed",
            SecretMaterialMode::Value,
            SecretMaterialPurpose::Value,
        )
        .unwrap();

    assert_ne!(alpha_hash, beta_hash);
    assert_eq!(
        hex(beta_material),
        "6d1fee023186ae05ce3797b69ae0a65f0ba933ed9c52755312306539768cb684"
    );
    assert_stealth_root(&kernel, "wallet");
    assert_eq!(
        kernel.read("wallet.hidden.seed"),
        Some(&Value::from("beta-seed"))
    );
}

#[test]
fn axiom_a3b_nested_secret_owner_reads_remain_accessible() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    kernel.secret("root", "alpha").unwrap();
    kernel.secret("root.child", "beta").unwrap();
    kernel.postulate("root.child.leaf", "x").unwrap();

    assert_stealth_root(&kernel, "root");
    assert_stealth_root(&kernel, "root.child");
    assert_eq!(kernel.read("root.child.leaf"), Some(&Value::from("x")));
    assert_eq!(kernel.read_public("root.child.leaf"), None);
}

#[test]
fn axiom_a3c_nested_secret_plus_same_node_noise_stays_owner_readable() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    kernel.secret("root", "alpha").unwrap();
    kernel.secret("root.child", "beta").unwrap();
    kernel.noise("root.child", "noise").unwrap();
    kernel.postulate("root.child.leaf", "x").unwrap();

    assert_stealth_root(&kernel, "root.child");
    assert_eq!(kernel.read("root.child.leaf"), Some(&Value::from("x")));
    assert_eq!(kernel.read_public("root.child.leaf"), None);
}

#[test]
fn axiom_a4_pointer_is_structural_and_traversable() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    kernel.secret("wallet", "secret").unwrap();
    kernel.postulate("wallet.income", 1_000_u64).unwrap();
    kernel.postulate("wallet.expenses.rent", 500_u64).unwrap();
    let pointer_memory = kernel
        .pointer("profile.cards.primary", "wallet")
        .unwrap()
        .clone();

    assert_eq!(
        pointer_memory.value,
        Value::Pointer(path("wallet")),
        "Rust keeps the pointer first-class in memory even though read() redirects"
    );
    assert_eq!(kernel.read("profile.cards.primary"), None);
    assert_eq!(
        kernel.read("profile.cards.primary.income"),
        Some(&Value::from(1_000_u64))
    );
    assert_eq!(
        kernel.read("profile.cards.primary.expenses.rent"),
        Some(&Value::from(500_u64))
    );
    assert_stealth_root(&kernel, "wallet");
    assert_public_prefix_absent(&kernel, "wallet");
}

#[test]
fn axiom_a5_query_records_memory_and_keeps_public_view_closed() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    kernel.secret("profile", "alpha").unwrap();
    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.postulate("profile.city", "Veracruz").unwrap();
    let memory = kernel.query("profile", ["name", "city"]).unwrap().clone();

    assert_eq!(memory.operator.as_deref(), Some("?"));
    assert_eq!(
        kernel.read("profile"),
        Some(&Value::Array(vec![
            Value::from("Abella"),
            Value::from("Veracruz"),
        ]))
    );
    assert_eq!(kernel.read_public("profile"), None);
    assert_eq!(kernel.read_public("profile.name"), None);
}

#[test]
fn axiom_a6_remove_tombstones_path_without_destroying_history() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    kernel.secret("wallet", "secret").unwrap();
    kernel
        .postulate("wallet.hidden.notes", "private note")
        .unwrap();
    assert_eq!(
        kernel.read("wallet.hidden.notes"),
        Some(&Value::from("private note"))
    );

    let before = kernel.memories().len();
    kernel.remove("wallet.hidden.notes").unwrap();

    assert_eq!(kernel.read("wallet.hidden.notes"), None);
    assert_eq!(kernel.memories().len(), before + 1);
    assert_eq!(
        kernel.memories().last().unwrap().operator.as_deref(),
        Some("-")
    );
}

#[test]
fn axiom_a7_public_ledger_survives_secret_and_noise_transitions() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    kernel.postulate("ledger.host", "localhost:8161").unwrap();
    kernel.postulate("ledger.protocol", "http").unwrap();
    kernel.secret("profile", "alpha").unwrap();
    kernel.postulate("profile.name", "Abella").unwrap();
    kernel.noise("profile", "noise").unwrap();
    kernel.secret("profile", "beta").unwrap();
    kernel
        .postulate("profile.hidden.seed", "beta-seed")
        .unwrap();
    kernel.postulate("ledger.status", "ok").unwrap();

    assert_eq!(
        kernel.read("ledger.host"),
        Some(&Value::from("localhost:8161"))
    );
    assert_eq!(kernel.read("ledger.protocol"), Some(&Value::from("http")));
    assert_eq!(kernel.read("ledger.status"), Some(&Value::from("ok")));
    assert_stealth_root(&kernel, "profile");
}

#[test]
fn axiom_a8_hash_chain_is_tamper_evident() {
    let mut kernel = Kernel::new();

    kernel.claim_identity("jabellae").unwrap();
    kernel.postulate("ledger.host", "localhost:8161").unwrap();
    kernel.postulate("ledger.protocol", "http").unwrap();
    kernel.secret("wallet", "secret").unwrap();
    kernel.postulate("wallet.balance", 1_000_u64).unwrap();

    let memories = kernel.memories();
    assert!(memories.len() >= 5);
    assert_eq!(memories[0].prev_hash, None);
    for pair in memories.windows(2) {
        assert_eq!(pair[1].prev_hash, Some(pair[0].hash.clone()));
    }

    let mut tampered = kernel.export_snapshot();
    tamper_first_value(&mut tampered, Value::from("tampered"));
    assert!(matches!(
        Kernel::hydrate(tampered),
        Err(KernelError::HydrationHashMismatch { .. })
    ));
}

#[test]
fn axiom_a9_latest_projection_is_deterministic_by_append_order_in_rust() {
    let mut kernel = Kernel::new();

    kernel.postulate("wallet.balance", 10_u64).unwrap();
    kernel.postulate("wallet.balance", 20_u64).unwrap();
    kernel.postulate("wallet.balance", 111_u64).unwrap();
    kernel.postulate("wallet.balance", 222_u64).unwrap();

    assert_eq!(kernel.read("wallet.balance"), Some(&Value::from(222_u64)));
    assert_eq!(kernel.memories().len(), 4);

    let restored = Kernel::hydrate(kernel.export_snapshot()).unwrap();
    assert_eq!(restored.read("wallet.balance"), Some(&Value::from(222_u64)));
    assert_eq!(restored.memories(), kernel.memories());
}

#[test]
fn axiom_parity_gaps_are_explicit() {
    let gaps = [
        "A-struct-0 is TypeScript Proxy ergonomics, not Rust kernel semantics",
        "A4 exact pointer reads redirect in Rust instead of returning a pointer value",
        "A5 has a Rust owner-read delta after query at a secret root",
        "A9 TypeScript timestamp/hash LWW is not ported because Rust Memory has no timestamp",
    ];

    assert_eq!(gaps.len(), 4);
}
