use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use this_me::kernel::Value;
use this_me::runtime::{runtime_receipt_to_json, KernelRuntime};
use this_me::storage::JsonFileStore;

fn temp_state_path(label: &str) -> std::path::PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "this-me-example-{label}-{}-{nonce}.json",
        std::process::id()
    ))
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let path = temp_state_path("runtime");
    let mut runtime = KernelRuntime::load(JsonFileStore::new(&path))?;

    let receipt = runtime.write_with_receipt("apps.demo.home.count", 3_u64)?;
    let json = runtime_receipt_to_json(&receipt);

    assert_eq!(json["events"][0]["path"][0], "apps");
    assert_eq!(json["events"][0]["path"][2], "home");
    assert_eq!(json["events"][0]["value"], 3.0);

    let restored = KernelRuntime::load(JsonFileStore::new(&path))?;
    assert_eq!(
        restored.read("apps.demo.home.count"),
        Some(&Value::from(3_u64))
    );
    assert!(restored.events().is_empty());

    println!("{json}");
    let _ = fs::remove_file(path);
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    run()
}

#[test]
fn example_runs() {
    run().unwrap();
}
