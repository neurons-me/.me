use std::collections::BTreeMap;

use this_me::kernel::{
    generate_p256_key_pair, unwrap_secret_v1, wrap_secret_v1, Value, WrappedSecretCleartext,
    WrappedSecretOutput,
};

fn object(entries: impl IntoIterator<Item = (&'static str, Value)>) -> Value {
    Value::Object(
        entries
            .into_iter()
            .map(|(key, value)| (key.to_string(), value))
            .collect::<BTreeMap<_, _>>(),
    )
}

fn string_field<'a>(object: &'a BTreeMap<String, Value>, key: &str) -> &'a str {
    let Value::String(value) = object.get(key).expect("field should exist") else {
        panic!("{key} should be a string");
    };
    value
}

fn object_field<'a>(object: &'a BTreeMap<String, Value>, key: &str) -> &'a BTreeMap<String, Value> {
    let Value::Object(value) = object.get(key).expect("field should exist") else {
        panic!("{key} should be an object");
    };
    value
}

#[test]
fn wrapped_secret_v1_round_trips_with_matching_private_key() {
    let recipient = generate_p256_key_pair().unwrap();
    let policy = object([
        ("appId", Value::from("orgboat")),
        (
            "usage",
            Value::Array(vec![Value::from("sign"), Value::from("derive")]),
        ),
        ("label", Value::from("Orgboat Key")),
        ("hardwareBound", Value::from(true)),
    ]);

    let envelope = wrap_secret_v1(
        "orgboat-super-secret",
        &recipient.public_key,
        "orgboat.keysCustomName",
        "identity-key",
        Some(&recipient.public_key),
        Some(policy),
    )
    .unwrap();

    let Value::Object(root) = &envelope else {
        panic!("envelope should be an object");
    };
    assert_eq!(root.get("version"), Some(&Value::from(1_u64)));
    assert_eq!(root.get("class"), Some(&Value::from("identity-key")));
    assert_eq!(
        root.get("kid"),
        Some(&Value::from("orgboat.keysCustomName"))
    );
    let encryption = object_field(root, "encryption");
    assert_eq!(string_field(encryption, "kex"), "ECDH-ES");
    assert_eq!(string_field(encryption, "kdf"), "HKDF-SHA-256");
    assert_eq!(string_field(encryption, "aead"), "AES-256-GCM");
    assert!(!string_field(encryption, "iv").is_empty());
    assert!(!string_field(encryption, "tag").is_empty());
    assert!(!string_field(encryption, "ciphertext").is_empty());
    let ephemeral = object_field(encryption, "ephemeralPK");
    assert_eq!(string_field(ephemeral, "crv"), "P-256");
    assert!(!string_field(ephemeral, "x").is_empty());
    assert!(!string_field(ephemeral, "y").is_empty());

    let clear =
        unwrap_secret_v1(&envelope, &recipient.private_key, WrappedSecretOutput::Utf8).unwrap();
    assert_eq!(
        clear,
        WrappedSecretCleartext::Utf8("orgboat-super-secret".to_string())
    );
}

#[test]
fn wrong_private_key_and_tampering_fail_closed() {
    let recipient = generate_p256_key_pair().unwrap();
    let outsider = generate_p256_key_pair().unwrap();
    let envelope = wrap_secret_v1(
        "orgboat-super-secret",
        &recipient.public_key,
        "orgboat.keysCustomName",
        "identity-key",
        Some(&recipient.public_key),
        None,
    )
    .unwrap();

    assert!(
        unwrap_secret_v1(&envelope, &outsider.private_key, WrappedSecretOutput::Utf8,).is_err()
    );

    let mut tampered_ciphertext = envelope.clone();
    flip_nested_string(&mut tampered_ciphertext, "ciphertext");
    assert!(unwrap_secret_v1(
        &tampered_ciphertext,
        &recipient.private_key,
        WrappedSecretOutput::Utf8,
    )
    .is_err());

    let mut tampered_tag = envelope;
    flip_nested_string(&mut tampered_tag, "tag");
    assert!(unwrap_secret_v1(
        &tampered_tag,
        &recipient.private_key,
        WrappedSecretOutput::Utf8,
    )
    .is_err());
}

fn flip_nested_string(envelope: &mut Value, key: &str) {
    let Value::Object(root) = envelope else {
        panic!("envelope should be an object");
    };
    let Some(Value::Object(encryption)) = root.get_mut("encryption") else {
        panic!("encryption should be an object");
    };
    let Some(Value::String(value)) = encryption.get_mut(key) else {
        panic!("{key} should be a string");
    };
    let replacement = if value.ends_with('A') { 'B' } else { 'A' };
    value.pop();
    value.push(replacement);
}
