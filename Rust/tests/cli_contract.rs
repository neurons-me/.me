use std::fs;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value as JsonValue;
use this_me::kernel::verify_ed25519_signature;

#[test]
fn cli_writes_reads_and_persists_snapshot_state() {
    let state = temp_state_path("write-read");
    fs::write(&state, "").expect("empty state fixture should be writable");

    let write = me()
        .args([
            "--state",
            state.to_str().unwrap(),
            "write",
            "profile.name",
            "\"Rusty\"",
        ])
        .output()
        .expect("me binary should run");
    assert_success(&write);
    assert_eq!(parse_stdout(&write), JsonValue::String("Rusty".to_string()));

    let read = me()
        .args(["--state", state.to_str().unwrap(), "read", "profile.name"])
        .output()
        .expect("me binary should run");
    assert_success(&read);
    assert_eq!(parse_stdout(&read), JsonValue::String("Rusty".to_string()));

    let snapshot = serde_json::from_str::<JsonValue>(&fs::read_to_string(&state).unwrap())
        .expect("state should be JSON");
    assert_eq!(snapshot.pointer("/memories/0/path/0").unwrap(), "profile");
    assert_eq!(snapshot.pointer("/memories/0/path/1").unwrap(), "name");

    let _ = fs::remove_file(state);
}

#[test]
fn cli_exec_uses_canonical_me_uri_dispatch() {
    let state = temp_state_path("exec");

    let write = me()
        .args([
            "--state",
            state.to_str().unwrap(),
            "exec",
            "me://self:write/wallet.income",
            "1000",
        ])
        .output()
        .expect("me binary should run");
    assert_success(&write);

    let read = me()
        .args([
            "--state",
            state.to_str().unwrap(),
            "exec",
            "me://self:read/wallet.income",
        ])
        .output()
        .expect("me binary should run");
    assert_success(&read);
    assert_eq!(
        parse_stdout(&read),
        serde_json::from_str::<JsonValue>("1000.0").unwrap()
    );

    let _ = fs::remove_file(state);
}

#[test]
fn cli_prove_emits_verifiable_ed25519_proof() {
    let output = me()
        .args([
            "--who",
            "jabellae",
            "--secret",
            "correct horse battery staple",
            "prove",
            "local.netget",
            "{\"nonce\":\"n-1\"}",
        ])
        .output()
        .expect("me binary should run");
    assert_success(&output);

    let proof = parse_stdout(&output);
    assert_eq!(proof["expression"], "jabellae");
    assert_eq!(proof["rootNamespace"], "local.netget");
    assert!(verify_ed25519_signature(
        proof["publicKey"].as_str().unwrap(),
        proof["message"].as_str().unwrap(),
        proof["signature"].as_str().unwrap(),
    ));
}

fn me() -> Command {
    Command::new(env!("CARGO_BIN_EXE_me"))
}

fn assert_success(output: &std::process::Output) {
    assert!(
        output.status.success(),
        "command failed\nstdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

fn parse_stdout(output: &std::process::Output) -> JsonValue {
    serde_json::from_slice(&output.stdout).expect("stdout should be JSON")
}

fn temp_state_path(label: &str) -> std::path::PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "this-me-rust-cli-{label}-{}-{nonce}.json",
        std::process::id()
    ))
}
