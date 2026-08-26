use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value as JsonValue;
use this_me::kernel::{Kernel, Value};
use this_me::storage::{JsonFileStore, MemoryStore};

#[test]
fn json_file_store_persists_and_hydrates_kernel_snapshot() {
    let path = temp_state_path("round-trip");
    let store = JsonFileStore::new(&path);

    let mut kernel = Kernel::new();
    kernel.postulate("profile.name", "Jabellae").unwrap();
    kernel
        .derive("", "wallet.total", "wallet.income - wallet.expenses")
        .unwrap();
    kernel.postulate("wallet.income", 100_u64).unwrap();
    kernel.postulate("wallet.expenses", 40_u64).unwrap();

    store.save_kernel(&kernel).unwrap();
    let restored = store.load_kernel().unwrap();

    assert_eq!(
        restored.read("profile.name"),
        Some(&Value::from("Jabellae"))
    );
    assert_eq!(restored.read("wallet.total"), Some(&Value::from(60_u64)));

    let raw = fs::read_to_string(&path).unwrap();
    let json = serde_json::from_str::<JsonValue>(&raw).unwrap();
    assert!(json["memories"].as_array().unwrap().len() >= 4);

    let _ = fs::remove_file(path);
}

#[test]
fn json_file_store_treats_missing_or_empty_file_as_fresh_kernel() {
    let path = temp_state_path("empty");
    let store = JsonFileStore::new(&path);

    assert_eq!(store.load_kernel().unwrap().memories().len(), 0);

    fs::write(&path, "").unwrap();
    assert_eq!(store.load_kernel().unwrap().memories().len(), 0);

    let _ = fs::remove_file(path);
}

#[test]
fn json_file_store_rejects_tampered_snapshot_on_load() {
    let path = temp_state_path("tampered");
    let store = JsonFileStore::new(&path);
    let mut kernel = Kernel::new();
    kernel.postulate("profile.name", "Jabellae").unwrap();

    store.save_kernel(&kernel).unwrap();
    let mut json = serde_json::from_str::<JsonValue>(&fs::read_to_string(&path).unwrap()).unwrap();
    json["memories"][0]["value"] = JsonValue::String("Mallory".to_string());
    fs::write(&path, serde_json::to_string_pretty(&json).unwrap()).unwrap();

    let error = store
        .load_kernel()
        .expect_err("tampered snapshot should fail closed");
    assert!(error.to_string().contains("memory hash mismatch"));

    let _ = fs::remove_file(path);
}

fn temp_state_path(label: &str) -> std::path::PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "this-me-rust-store-{label}-{}-{nonce}.json",
        std::process::id()
    ))
}
