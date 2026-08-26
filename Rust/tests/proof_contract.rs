use this_me::kernel::{
    derive_compound_seed, derive_identity_hash, normalize_proof_payload, verify_ed25519_signature,
    Kernel, ProofError, ProofInput,
};

#[test]
fn compound_seed_and_identity_hash_match_typescript_documentation() {
    let seed = derive_compound_seed("ana", "secret");
    let identity_hash = derive_identity_hash(&seed);

    assert_eq!(
        seed,
        "3f618b81832520de17f512a441f7ecd3d3e28b4dc9cb79d106aa669e2dd5d68a"
    );
    assert_eq!(
        identity_hash,
        "e1880e47492aa4140b44d6098afa39493015434d76d567f32d4edaef24366dc0"
    );
}

#[test]
fn proof_message_normalizes_payload_like_typescript() {
    assert_eq!(
        normalize_proof_payload(
            "identity",
            "jabellae",
            "jabellae.suis-macbook-air.local",
            "suis-macbook-air.local",
            Some("{\"method\":\"POST\"}"),
            1_776_000_000_000,
        ),
        "{\"challenge\":\"{\\\"method\\\":\\\"POST\\\"}\",\"expression\":\"jabellae\",\"identityHash\":\"identity\",\"namespace\":\"jabellae.suis-macbook-air.local\",\"rootNamespace\":\"suis-macbook-air.local\",\"timestamp\":1776000000000}"
    );
}

#[test]
fn prove_signs_branch_scoped_message_and_verifies() {
    let kernel = Kernel::with_compound_seed("jabellae", "secret");

    let proof = kernel
        .prove_with_timestamp(
            ProofInput {
                root_namespace: "https://suis-macbook-air.local/".to_string(),
                challenge: Some("{\"method\":\"POST\",\"path\":\"/domains\"}".to_string()),
            },
            1_776_000_000_000,
        )
        .unwrap();

    assert_eq!(proof.expression, "jabellae");
    assert_eq!(proof.root_namespace, "suis-macbook-air.local");
    assert_eq!(proof.namespace, "jabellae.suis-macbook-air.local");
    assert_eq!(proof.identity_hash, kernel.identity_hash().unwrap());
    assert!(verify_ed25519_signature(
        &proof.public_key,
        &proof.message,
        &proof.signature
    ));
    assert!(!verify_ed25519_signature(
        &proof.public_key,
        &proof.message.replace("POST", "GET"),
        &proof.signature
    ));
}

#[test]
fn prove_requires_active_expression_and_root_namespace() {
    let kernel = Kernel::with_seed("not-bound-yet");
    let expression_error = kernel
        .prove_with_timestamp(
            ProofInput {
                root_namespace: "suis-macbook-air.local".to_string(),
                challenge: None,
            },
            1,
        )
        .unwrap_err();
    assert!(matches!(
        expression_error,
        ProofError::ActiveExpressionRequired
    ));

    let kernel = Kernel::with_compound_seed("jabellae", "secret");
    let root_error = kernel
        .prove_with_timestamp(
            ProofInput {
                root_namespace: "https://.../".to_string(),
                challenge: None,
            },
            1,
        )
        .unwrap_err();
    assert!(matches!(root_error, ProofError::RootNamespaceRequired));
}
