use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use this_me::kernel::{ExecuteValue, Value};
use this_me::runtime::KernelRuntime;
use this_me::storage::JsonFileStore;

#[test]
fn runtime_write_persists_and_reloads_kernel_state() {
    let path = temp_state_path("write");
    let store = JsonFileStore::new(&path);
    let mut runtime = KernelRuntime::load(store).unwrap();

    let memory = runtime.write("profile.name", "Jabellae").unwrap();
    assert_eq!(memory.path, vec!["profile".to_string(), "name".to_string()]);
    assert_eq!(runtime.read("profile.name"), Some(&Value::from("Jabellae")));

    let restored = KernelRuntime::load(JsonFileStore::new(&path)).unwrap();
    assert_eq!(
        restored.read("profile.name"),
        Some(&Value::from("Jabellae"))
    );

    let _ = fs::remove_file(path);
}

#[test]
fn runtime_execute_persists_mutating_me_targets() {
    let path = temp_state_path("execute");
    let mut runtime = KernelRuntime::load(JsonFileStore::new(&path)).unwrap();

    let result = runtime
        .execute(
            "me://self:write/apps.fulltrailer.units.count",
            Some(ExecuteValue::from(3_u64)),
        )
        .unwrap();

    assert_eq!(result, ExecuteValue::Value(Value::from(3_u64)));

    let restored = KernelRuntime::load(JsonFileStore::new(&path)).unwrap();
    assert_eq!(
        restored.read("apps.fulltrailer.units.count"),
        Some(&Value::from(3_u64))
    );

    let _ = fs::remove_file(path);
}

#[test]
fn runtime_filtered_events_are_live_not_persisted() {
    let path = temp_state_path("events");
    let mut runtime = KernelRuntime::load(JsonFileStore::new(&path)).unwrap();

    runtime.write("apps.fulltrailer.home.count", 3_u64).unwrap();
    runtime.write("profile.name", "Jabellae").unwrap();

    let matching = runtime.events_matching("apps.fulltrailer").unwrap();
    assert_eq!(matching.len(), 1);
    assert_eq!(
        matching[0].path,
        vec![
            "apps".to_string(),
            "fulltrailer".to_string(),
            "home".to_string(),
            "count".to_string()
        ]
    );

    let drained = runtime.drain_events_matching("apps.fulltrailer").unwrap();
    assert_eq!(drained, matching);
    assert_eq!(runtime.events().len(), 1);
    assert_eq!(
        runtime.events()[0].path,
        vec!["profile".to_string(), "name".to_string()]
    );

    let restored = KernelRuntime::load(JsonFileStore::new(&path)).unwrap();
    assert!(restored.events().is_empty());
    assert_eq!(
        restored.read("apps.fulltrailer.home.count"),
        Some(&Value::from(3_u64))
    );

    let _ = fs::remove_file(path);
}

#[test]
fn runtime_rejects_tampered_store_on_load() {
    let path = temp_state_path("tampered");
    let mut runtime = KernelRuntime::load(JsonFileStore::new(&path)).unwrap();
    runtime.write("profile.name", "Jabellae").unwrap();

    let mut json =
        serde_json::from_str::<serde_json::Value>(&fs::read_to_string(&path).unwrap()).unwrap();
    json["memories"][0]["value"] = serde_json::Value::String("Mallory".to_string());
    fs::write(&path, serde_json::to_string_pretty(&json).unwrap()).unwrap();

    let error = KernelRuntime::load(JsonFileStore::new(&path))
        .expect_err("tampered runtime snapshot should fail closed");
    assert!(error.to_string().contains("memory hash mismatch"));

    let _ = fs::remove_file(path);
}

fn temp_state_path(label: &str) -> std::path::PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "this-me-rust-runtime-{label}-{}-{nonce}.json",
        std::process::id()
    ))
}
