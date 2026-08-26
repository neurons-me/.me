use std::collections::BTreeMap;

use this_me::kernel::{
    generate_p256_key_pair, wrap_secret_v1, ExecuteError, ExecuteValue, Kernel, Value,
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

fn envelope(kid: &str) -> Value {
    object([
        ("version", Value::from(1_u64)),
        ("class", Value::from("identity-key")),
        ("kid", Value::from(kid)),
        (
            "encryption",
            object([
                ("kex", Value::from("ECDH-ES")),
                ("kdf", Value::from("HKDF-SHA-256")),
                ("aead", Value::from("AES-256-GCM")),
                ("iv", Value::from("test-iv")),
                ("salt", Value::from("test-salt")),
                ("tag", Value::from("test-tag")),
                ("ciphertext", Value::from("test-ciphertext")),
                ("ephemeralPK", object([("crv", Value::from("P-256"))])),
            ]),
        ),
    ])
}

#[test]
fn keyspace_write_read_and_manifest_match_typescript_routes() {
    let mut kernel = Kernel::new();
    let envelope = envelope("orgboat.keysCustomName");
    let recipient = generate_p256_key_pair().unwrap();

    kernel
        .install_recipient_key("self.master", recipient.private_key.to_bytes())
        .unwrap();

    assert_eq!(
        kernel
            .execute(
                "me://self:write/keys/orgboat.keysCustomName",
                Some(ExecuteValue::WrappedKeyWrite {
                    envelope: envelope.clone(),
                    recipient_key_id: Some("self.master".to_string()),
                }),
            )
            .unwrap(),
        ExecuteValue::WrappedKey(envelope.clone())
    );

    assert_eq!(
        kernel
            .execute("me://self:read/keys/orgboat.keysCustomName", None)
            .unwrap(),
        ExecuteValue::WrappedKey(envelope)
    );

    let ExecuteValue::KeySpaceManifest(manifest) =
        kernel.execute("me://self:read/keys", None).unwrap()
    else {
        panic!("self:read/keys should return a manifest");
    };
    assert_eq!(
        manifest
            .get("orgboat.keysCustomName")
            .and_then(|entry| entry.recipient_key_id.as_deref()),
        Some("self.master")
    );
}

#[test]
fn keyspace_envelopes_survive_snapshot_but_recipient_keys_do_not() {
    let mut kernel = Kernel::new();
    let recipient = generate_p256_key_pair().unwrap();
    let envelope = wrap_secret_v1(
        "orgboat-super-secret",
        &recipient.public_key,
        "orgboat.keysCustomName",
        "identity-key",
        Some(&recipient.public_key),
        None,
    )
    .unwrap();

    kernel
        .install_recipient_key("self.master", recipient.private_key.to_bytes())
        .unwrap();
    kernel
        .execute(
            "me://self:write/keys/orgboat.keysCustomName",
            Some(ExecuteValue::WrappedKeyWrite {
                envelope: envelope.clone(),
                recipient_key_id: Some("self.master".to_string()),
            }),
        )
        .unwrap();

    let snapshot = kernel.export_snapshot();
    assert!(snapshot.key_spaces.contains_key("orgboat.keysCustomName"));

    let mut recovered = Kernel::hydrate(snapshot).unwrap();
    assert_eq!(
        recovered
            .execute("me://self:read/keys/orgboat.keysCustomName", None)
            .unwrap(),
        ExecuteValue::WrappedKey(envelope)
    );

    let error = recovered
        .execute("me://self:open/keys/orgboat.keysCustomName", None)
        .unwrap_err();
    assert!(matches!(
        error,
        ExecuteError::NoRecipientPrivateKey(key_id) if key_id == "orgboat.keysCustomName"
    ));

    recovered
        .install_recipient_key("self.master", recipient.private_key.to_bytes())
        .unwrap();
    assert_eq!(
        recovered
            .execute(
                "me://self:use/keys/orgboat.keysCustomName",
                Some(ExecuteValue::WrappedKeyOpenOptions {
                    recipient_key_id: None,
                    recipient_private_key: None,
                    output: WrappedSecretOutput::Utf8,
                }),
            )
            .unwrap(),
        ExecuteValue::Value(Value::from("orgboat-super-secret"))
    );
}

#[test]
fn invalid_wrapped_key_envelopes_are_rejected() {
    let mut kernel = Kernel::new();

    let error = kernel
        .execute(
            "me://self:write/keys/app",
            Some(ExecuteValue::Value(object([(
                "version",
                Value::from(2_u64),
            )]))),
        )
        .unwrap_err();

    assert!(matches!(error, ExecuteError::InvalidWrappedKeyEnvelope));
}
