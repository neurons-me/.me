use this_me::kernel::{
    generate_p256_key_pair, unwrap_secret_v1, wrap_secret_v1, WrappedSecretCleartext,
    WrappedSecretOutput,
};

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let recipient = generate_p256_key_pair()?;
    let outsider = generate_p256_key_pair()?;

    let envelope = wrap_secret_v1(
        "shared-audience-secret",
        &recipient.public_key,
        "apps.demo.keys.audience",
        "identity-key",
        Some(&recipient.public_key),
        None,
    )?;

    let opened = unwrap_secret_v1(&envelope, &recipient.private_key, WrappedSecretOutput::Utf8)?;
    assert_eq!(
        opened,
        WrappedSecretCleartext::Utf8("shared-audience-secret".to_string())
    );

    assert!(unwrap_secret_v1(&envelope, &outsider.private_key, WrappedSecretOutput::Utf8).is_err());

    println!("wrapped audience key opens only for the recipient");
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    run()
}

#[test]
fn example_runs() {
    run().unwrap();
}
