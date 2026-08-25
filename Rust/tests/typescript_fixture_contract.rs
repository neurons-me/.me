use std::collections::BTreeMap;

use serde_json::Value as JsonValue;
use this_me::kernel::{Kernel, Memory, Path, Value};

const PUBLIC_REPLAY_FIXTURE: &str = include_str!("fixtures/typescript-public-replay-v4.0.1.json");

#[test]
fn rust_replays_typescript_public_memory_fixture() {
    let fixture = parse_fixture(PUBLIC_REPLAY_FIXTURE);
    let mut kernel = Kernel::new();

    kernel
        .replay_memories(fixture.memories)
        .expect("TypeScript public memories should replay in Rust");

    assert_eq!(kernel.memories().len(), fixture.memory_count);
    assert_eq!(kernel.read("profile.name"), Some(&Value::from("Jabellae")));
    assert_eq!(kernel.read("order.price"), Some(&Value::from(10_f64)));
    assert_eq!(kernel.read("order.quantity"), Some(&Value::from(3_f64)));
    assert_eq!(kernel.read("order.total"), Some(&Value::from(30_f64)));
    assert_eq!(
        kernel.read("profile.primary.total"),
        Some(&Value::from(30_f64))
    );
    assert_eq!(kernel.read("legacy.note"), None);
}

#[test]
fn rust_preserves_typescript_expression_value_shape() {
    let fixture = parse_fixture(PUBLIC_REPLAY_FIXTURE);
    let mut kernel = Kernel::new();

    kernel.replay_memories(fixture.memories).unwrap();

    assert_eq!(
        kernel.memories()[0].expression,
        Some(Value::from("Jabellae"))
    );
    assert_eq!(kernel.memories()[1].expression, Some(Value::from(10_f64)));
    assert_eq!(kernel.memories()[3].expression, Some(Value::from(30_f64)));
    assert_eq!(
        kernel.memories()[4].expression,
        Some(Value::Object(BTreeMap::from([(
            "__ptr".to_string(),
            Value::from("order")
        )])))
    );
}

#[test]
fn rust_replay_preserves_typescript_public_hashes_for_supported_shapes() {
    let fixture = parse_fixture(PUBLIC_REPLAY_FIXTURE);
    let source_hashes = fixture
        .memories
        .iter()
        .map(|memory| memory.hash.clone())
        .collect::<Vec<_>>();
    let mut kernel = Kernel::new();

    kernel.replay_memories(fixture.memories).unwrap();

    assert_eq!(source_hashes[0], "47b6919e");
    assert_eq!(kernel.memories()[0].prev_hash, None);
    assert_eq!(
        kernel.memories()[1].prev_hash,
        Some(kernel.memories()[0].hash.clone())
    );
    assert_eq!(
        kernel
            .memories()
            .iter()
            .map(|memory| memory.hash.clone())
            .collect::<Vec<_>>(),
        source_hashes
    );
}

struct ParsedFixture {
    memories: Vec<Memory>,
    memory_count: usize,
}

fn parse_fixture(input: &str) -> ParsedFixture {
    let json = serde_json::from_str::<JsonValue>(input).expect("fixture should be valid JSON");
    let memories = json
        .get("memories")
        .and_then(JsonValue::as_array)
        .expect("fixture should contain memories")
        .iter()
        .map(parse_memory)
        .collect::<Vec<_>>();
    let memory_count = json
        .pointer("/expectations/memoryCount")
        .and_then(JsonValue::as_u64)
        .expect("fixture should contain expected memory count") as usize;

    ParsedFixture {
        memories,
        memory_count,
    }
}

fn parse_memory(raw: &JsonValue) -> Memory {
    Memory {
        path: raw
            .get("path")
            .and_then(JsonValue::as_str)
            .map(parse_path)
            .expect("memory should contain a path"),
        operator: raw
            .get("operator")
            .and_then(JsonValue::as_str)
            .map(str::to_string),
        expression: raw.get("expression").map(parse_value),
        value: raw
            .get("value")
            .map(parse_value)
            .expect("memory should contain a value"),
        prev_hash: raw
            .get("prevHash")
            .and_then(JsonValue::as_str)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        hash: raw
            .get("hash")
            .and_then(JsonValue::as_str)
            .expect("memory should contain a hash")
            .to_string(),
    }
}

fn parse_path(value: &str) -> Path {
    if value.is_empty() {
        return Vec::new();
    }
    value.split('.').map(str::to_string).collect()
}

fn parse_value(raw: &JsonValue) -> Value {
    match raw {
        JsonValue::Null => Value::Null,
        JsonValue::Bool(value) => Value::Bool(*value),
        JsonValue::Number(value) => Value::Number(value.as_f64().expect("number should fit f64")),
        JsonValue::String(value) => Value::String(value.clone()),
        JsonValue::Array(values) => Value::Array(values.iter().map(parse_value).collect()),
        JsonValue::Object(values) => Value::Object(
            values
                .iter()
                .map(|(key, value)| (key.clone(), parse_value(value)))
                .collect::<BTreeMap<_, _>>(),
        ),
    }
}
