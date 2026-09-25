use serde_json::Value;
use this_me::kernel::{derive_blob_v4_keys, BlobV4Mode};

fn bytes(value: &Value) -> Vec<u8> {
    let s = value.as_str().unwrap();
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
        .collect()
}

#[test]
fn v4_kdf_matches_typescript_source_vectors() {
    let fixture: Value =
        serde_json::from_str(include_str!("fixtures/typescript-v4-kdf.json")).unwrap();
    for v in fixture["vectors"].as_array().unwrap() {
        let chain: Vec<_> = v["chain"].as_array().unwrap().iter().map(bytes).collect();
        let path: Vec<_> = v["path"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| p.as_str().unwrap().to_owned())
            .collect();
        let mode = if v["mode"] == "branch" {
            BlobV4Mode::Branch
        } else {
            BlobV4Mode::Value
        };
        let root = bytes(&v["root"]);
        let keys = derive_blob_v4_keys(&chain, mode, &path, &root).unwrap();
        assert_eq!(
            keys.enc_key.as_slice(),
            bytes(&v["encKey"]),
            "{}",
            v["name"]
        );
        assert_eq!(
            keys.mac_key.as_slice(),
            bytes(&v["macKey"]),
            "{}",
            v["name"]
        );
        assert_eq!(keys.path_context, bytes(&v["pathContext"]));
        assert!(derive_blob_v4_keys(&chain, mode, &path, &[]).is_none());
        assert!(derive_blob_v4_keys(&chain[..4], mode, &path, &root).is_none());
        let mut changed_root = root.clone();
        changed_root[0] ^= 1;
        assert_ne!(
            keys.enc_key,
            derive_blob_v4_keys(&chain, mode, &path, &changed_root)
                .unwrap()
                .enc_key
        );
    }
}
