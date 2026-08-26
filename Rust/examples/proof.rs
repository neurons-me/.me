use this_me::kernel::{verify_ed25519_signature, Kernel, ProofInput};

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let me = Kernel::with_compound_seed("jabellae", "correct horse battery staple");

    let proof = me.prove_with_timestamp(
        ProofInput {
            root_namespace: "https://local.netget/".to_string(),
            challenge: Some("{\"method\":\"POST\",\"path\":\"/apps/demo\"}".to_string()),
        },
        1_776_000_000_000,
    )?;

    assert_eq!(proof.expression, "jabellae");
    assert_eq!(proof.namespace, "jabellae.local.netget");
    assert_eq!(proof.root_namespace, "local.netget");
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

    println!("identity_hash = {}", proof.identity_hash);
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    run()
}

#[test]
fn example_runs() {
    run().unwrap();
}
