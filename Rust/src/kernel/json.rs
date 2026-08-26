use std::collections::BTreeMap;
use std::fmt;

use serde_json::{Map, Value as JsonValue};

use super::{
    ExecuteValue, ExplainInput, ExplainOrigin, ExplainResult, InspectMemory, InspectResult,
    IntoPath, KernelEvent, Memory, OperatorDefinition, Path, ProofResult, RecomputeMode, Snapshot,
    StoredWrappedKey, Value,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JsonCodecError {
    InvalidJson(String),
    ExpectedObject(&'static str),
    ExpectedArray(&'static str),
    ExpectedString(&'static str),
    ExpectedFiniteNumber,
    MissingField(&'static str),
    InvalidPath(String),
}

impl fmt::Display for JsonCodecError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidJson(error) => write!(f, "invalid JSON: {error}"),
            Self::ExpectedObject(field) => write!(f, "{field} must be an object"),
            Self::ExpectedArray(field) => write!(f, "{field} must be an array"),
            Self::ExpectedString(field) => write!(f, "{field} must be a string"),
            Self::ExpectedFiniteNumber => write!(f, "numbers must be finite"),
            Self::MissingField(field) => write!(f, "missing required field: {field}"),
            Self::InvalidPath(path) => write!(f, "invalid path: {path}"),
        }
    }
}

impl std::error::Error for JsonCodecError {}

pub fn parse_kernel_value(input: &str) -> Result<Value, JsonCodecError> {
    let json = serde_json::from_str::<JsonValue>(input)
        .map_err(|error| JsonCodecError::InvalidJson(error.to_string()))?;
    kernel_value_from_json(&json)
}

pub fn kernel_value_to_json(value: &Value) -> JsonValue {
    match value {
        Value::Null => JsonValue::Null,
        Value::Bool(value) => JsonValue::Bool(*value),
        Value::Number(value) => serde_json::Number::from_f64(*value)
            .map(JsonValue::Number)
            .unwrap_or(JsonValue::Null),
        Value::String(value) => JsonValue::String(value.clone()),
        Value::Array(values) => JsonValue::Array(values.iter().map(kernel_value_to_json).collect()),
        Value::Object(values) => JsonValue::Object(
            values
                .iter()
                .map(|(key, value)| (key.clone(), kernel_value_to_json(value)))
                .collect(),
        ),
        Value::Pointer(path) => {
            JsonValue::Object(Map::from_iter([("__ptr".to_string(), path_to_json(path))]))
        }
        Value::Identity(id) => JsonValue::Object(Map::from_iter([(
            "__id".to_string(),
            JsonValue::String(id.clone()),
        )])),
    }
}

pub fn kernel_value_from_json(raw: &JsonValue) -> Result<Value, JsonCodecError> {
    match raw {
        JsonValue::Null => Ok(Value::Null),
        JsonValue::Bool(value) => Ok(Value::Bool(*value)),
        JsonValue::Number(value) => value
            .as_f64()
            .filter(|value| value.is_finite())
            .map(Value::Number)
            .ok_or(JsonCodecError::ExpectedFiniteNumber),
        JsonValue::String(value) => Ok(Value::String(value.clone())),
        JsonValue::Array(values) => values
            .iter()
            .map(kernel_value_from_json)
            .collect::<Result<Vec<_>, _>>()
            .map(Value::Array),
        JsonValue::Object(values) => {
            if values.len() == 1 {
                if let Some(raw_path) = values.get("__ptr") {
                    return path_from_json(raw_path, "__ptr").map(Value::Pointer);
                }
                if let Some(raw_id) = values.get("__id") {
                    return raw_id
                        .as_str()
                        .map(|id| Value::Identity(id.to_string()))
                        .ok_or(JsonCodecError::ExpectedString("__id"));
                }
            }

            values
                .iter()
                .map(|(key, value)| Ok((key.clone(), kernel_value_from_json(value)?)))
                .collect::<Result<BTreeMap<_, _>, JsonCodecError>>()
                .map(Value::Object)
        }
    }
}

pub fn execute_value_to_json(value: &ExecuteValue) -> JsonValue {
    match value {
        ExecuteValue::None => JsonValue::Null,
        ExecuteValue::Value(value) => kernel_value_to_json(value),
        ExecuteValue::Memories(memories) => {
            JsonValue::Array(memories.iter().map(memory_to_json).collect())
        }
        ExecuteValue::Events(events) => {
            JsonValue::Array(events.iter().map(kernel_event_to_json).collect())
        }
        ExecuteValue::Snapshot(snapshot) => snapshot_to_json(snapshot),
        ExecuteValue::Inspect(inspect) => inspect_to_json(inspect),
        ExecuteValue::Explain(explain) => explain_to_json(explain),
        ExecuteValue::Mode(mode) => JsonValue::String(recompute_mode_to_string(*mode).to_string()),
        ExecuteValue::KeySpaceManifest(manifest) => keyspaces_to_json(manifest),
        ExecuteValue::WrappedKey(value) => kernel_value_to_json(value),
        ExecuteValue::WrappedKeyWrite {
            envelope,
            recipient_key_id,
        } => JsonValue::Object(Map::from_iter([
            ("envelope".to_string(), kernel_value_to_json(envelope)),
            (
                "recipientKeyId".to_string(),
                optional_string_to_json(recipient_key_id.as_deref()),
            ),
        ])),
        ExecuteValue::WrappedKeyOpenOptions {
            recipient_key_id,
            recipient_private_key,
            output,
        } => JsonValue::Object(Map::from_iter([
            (
                "recipientKeyId".to_string(),
                optional_string_to_json(recipient_key_id.as_deref()),
            ),
            (
                "recipientPrivateKey".to_string(),
                recipient_private_key
                    .as_ref()
                    .map(|key| bytes_to_json(&key.to_bytes()))
                    .unwrap_or(JsonValue::Null),
            ),
            (
                "output".to_string(),
                JsonValue::String(format!("{output:?}")),
            ),
        ])),
        ExecuteValue::RecipientPrivateKey(bytes) | ExecuteValue::Bytes(bytes) => {
            bytes_to_json(bytes)
        }
    }
}

pub fn kernel_event_to_json(event: &KernelEvent) -> JsonValue {
    JsonValue::Object(Map::from_iter([
        ("path".to_string(), path_to_json(&event.path)),
        (
            "operator".to_string(),
            optional_string_to_json(event.operator.as_deref()),
        ),
        (
            "value".to_string(),
            event
                .value
                .as_ref()
                .map(kernel_value_to_json)
                .unwrap_or(JsonValue::Null),
        ),
        (
            "memoryHash".to_string(),
            JsonValue::String(event.memory_hash.clone()),
        ),
    ]))
}

pub fn proof_result_to_json(proof: &ProofResult) -> JsonValue {
    JsonValue::Object(Map::from_iter([
        (
            "identityHash".to_string(),
            JsonValue::String(proof.identity_hash.clone()),
        ),
        (
            "expression".to_string(),
            JsonValue::String(proof.expression.clone()),
        ),
        (
            "namespace".to_string(),
            JsonValue::String(proof.namespace.clone()),
        ),
        (
            "rootNamespace".to_string(),
            JsonValue::String(proof.root_namespace.clone()),
        ),
        (
            "publicKey".to_string(),
            JsonValue::String(proof.public_key.clone()),
        ),
        (
            "message".to_string(),
            JsonValue::String(proof.message.clone()),
        ),
        (
            "signature".to_string(),
            JsonValue::String(proof.signature.clone()),
        ),
        (
            "timestamp".to_string(),
            JsonValue::Number(serde_json::Number::from(proof.timestamp)),
        ),
    ]))
}

pub fn snapshot_to_json(snapshot: &Snapshot) -> JsonValue {
    JsonValue::Object(Map::from_iter([
        (
            "memories".to_string(),
            JsonValue::Array(snapshot.memories.iter().map(memory_to_json).collect()),
        ),
        (
            "localSecrets".to_string(),
            string_path_map_to_json(&snapshot.local_secrets, "secret"),
        ),
        (
            "localNoises".to_string(),
            string_path_map_to_json(&snapshot.local_noises, "noise"),
        ),
        (
            "keySpaces".to_string(),
            keyspaces_to_json(&snapshot.key_spaces),
        ),
        (
            "operators".to_string(),
            operators_to_json(&snapshot.operators),
        ),
    ]))
}

pub fn snapshot_from_json(raw: &JsonValue) -> Result<Snapshot, JsonCodecError> {
    let object = raw
        .as_object()
        .ok_or(JsonCodecError::ExpectedObject("snapshot"))?;
    let memories = object
        .get("memories")
        .ok_or(JsonCodecError::MissingField("memories"))?
        .as_array()
        .ok_or(JsonCodecError::ExpectedArray("memories"))?
        .iter()
        .map(memory_from_json)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Snapshot {
        memories,
        local_secrets: string_path_map_from_json(object.get("localSecrets"), "localSecrets")?,
        local_noises: string_path_map_from_json(object.get("localNoises"), "localNoises")?,
        key_spaces: keyspaces_from_json(object.get("keySpaces"))?,
        operators: operators_from_json(object.get("operators"))?,
    })
}

pub fn memory_to_json(memory: &Memory) -> JsonValue {
    JsonValue::Object(Map::from_iter([
        ("path".to_string(), path_to_json(&memory.path)),
        (
            "operator".to_string(),
            optional_string_to_json(memory.operator.as_deref()),
        ),
        (
            "expression".to_string(),
            memory
                .expression
                .as_ref()
                .map(kernel_value_to_json)
                .unwrap_or(JsonValue::Null),
        ),
        ("value".to_string(), kernel_value_to_json(&memory.value)),
        (
            "prevHash".to_string(),
            optional_string_to_json(memory.prev_hash.as_deref()),
        ),
        ("hash".to_string(), JsonValue::String(memory.hash.clone())),
    ]))
}

fn memory_from_json(raw: &JsonValue) -> Result<Memory, JsonCodecError> {
    let object = raw
        .as_object()
        .ok_or(JsonCodecError::ExpectedObject("memory"))?;
    let path = path_from_json(
        object
            .get("path")
            .ok_or(JsonCodecError::MissingField("path"))?,
        "path",
    )?;
    let operator = optional_string_from_json(object.get("operator"), "operator")?;
    let expression = match object.get("expression") {
        Some(JsonValue::Null) | None => None,
        Some(value) => Some(kernel_value_from_json(value)?),
    };
    let value = kernel_value_from_json(
        object
            .get("value")
            .ok_or(JsonCodecError::MissingField("value"))?,
    )?;
    let prev_hash = optional_string_from_json(object.get("prevHash"), "prevHash")?;
    let hash = object
        .get("hash")
        .and_then(JsonValue::as_str)
        .ok_or(JsonCodecError::ExpectedString("hash"))?
        .to_string();

    Ok(Memory {
        path,
        operator,
        expression,
        value,
        prev_hash,
        hash,
    })
}

fn inspect_to_json(inspect: &InspectResult) -> JsonValue {
    JsonValue::Object(Map::from_iter([
        (
            "memories".to_string(),
            JsonValue::Array(
                inspect
                    .memories
                    .iter()
                    .map(inspect_memory_to_json)
                    .collect(),
            ),
        ),
        ("index".to_string(), path_value_map_to_json(&inspect.index)),
        (
            "secretScopes".to_string(),
            paths_to_json(&inspect.secret_scopes),
        ),
        (
            "noiseScopes".to_string(),
            paths_to_json(&inspect.noise_scopes),
        ),
        (
            "derivations".to_string(),
            paths_to_json(&inspect.derivations),
        ),
    ]))
}

fn inspect_memory_to_json(memory: &InspectMemory) -> JsonValue {
    JsonValue::Object(Map::from_iter([
        ("path".to_string(), path_to_json(&memory.path)),
        (
            "operator".to_string(),
            optional_string_to_json(memory.operator.as_deref()),
        ),
        (
            "expression".to_string(),
            memory
                .expression
                .as_ref()
                .map(kernel_value_to_json)
                .unwrap_or(JsonValue::Null),
        ),
        ("value".to_string(), kernel_value_to_json(&memory.value)),
        (
            "prevHash".to_string(),
            optional_string_to_json(memory.prev_hash.as_deref()),
        ),
        ("hash".to_string(), JsonValue::String(memory.hash.clone())),
    ]))
}

fn explain_to_json(explain: &ExplainResult) -> JsonValue {
    JsonValue::Object(Map::from_iter([
        ("path".to_string(), path_to_json(&explain.path)),
        (
            "value".to_string(),
            explain
                .value
                .as_ref()
                .map(kernel_value_to_json)
                .unwrap_or(JsonValue::Null),
        ),
        (
            "expr".to_string(),
            optional_string_to_json(explain.expr.as_deref()),
        ),
        (
            "derivation".to_string(),
            explain
                .derivation
                .as_ref()
                .map(|derivation| {
                    JsonValue::Object(Map::from_iter([
                        (
                            "expression".to_string(),
                            JsonValue::String(derivation.expression.clone()),
                        ),
                        (
                            "inputs".to_string(),
                            JsonValue::Array(
                                derivation
                                    .inputs
                                    .iter()
                                    .map(explain_input_to_json)
                                    .collect(),
                            ),
                        ),
                    ]))
                })
                .unwrap_or(JsonValue::Null),
        ),
        (
            "meta".to_string(),
            JsonValue::Object(Map::from_iter([
                (
                    "dependsOn".to_string(),
                    paths_to_json(&explain.meta.depends_on),
                ),
                (
                    "resolvedPath".to_string(),
                    path_to_json(&explain.meta.resolved_path),
                ),
                (
                    "pointerChain".to_string(),
                    paths_to_json(&explain.meta.pointer_chain),
                ),
                ("secret".to_string(), JsonValue::Bool(explain.meta.secret)),
                (
                    "k".to_string(),
                    JsonValue::Number(serde_json::Number::from(explain.meta.k)),
                ),
                (
                    "recomputed".to_string(),
                    paths_to_json(&explain.meta.recomputed),
                ),
                (
                    "sourcePath".to_string(),
                    explain
                        .meta
                        .source_path
                        .as_ref()
                        .map(path_to_json)
                        .unwrap_or(JsonValue::Null),
                ),
            ])),
        ),
    ]))
}

fn explain_input_to_json(input: &ExplainInput) -> JsonValue {
    JsonValue::Object(Map::from_iter([
        ("label".to_string(), JsonValue::String(input.label.clone())),
        ("path".to_string(), path_to_json(&input.path)),
        (
            "value".to_string(),
            input
                .value
                .as_ref()
                .map(kernel_value_to_json)
                .unwrap_or(JsonValue::Null),
        ),
        (
            "origin".to_string(),
            JsonValue::String(
                match input.origin {
                    ExplainOrigin::Public => "public",
                    ExplainOrigin::Secret => "secret",
                }
                .to_string(),
            ),
        ),
        ("masked".to_string(), JsonValue::Bool(input.masked)),
    ]))
}

fn keyspaces_to_json(key_spaces: &BTreeMap<String, StoredWrappedKey>) -> JsonValue {
    JsonValue::Object(
        key_spaces
            .iter()
            .map(|(key_id, stored)| {
                (
                    key_id.clone(),
                    JsonValue::Object(Map::from_iter([
                        (
                            "envelope".to_string(),
                            kernel_value_to_json(&stored.envelope),
                        ),
                        (
                            "recipientKeyId".to_string(),
                            optional_string_to_json(stored.recipient_key_id.as_deref()),
                        ),
                    ])),
                )
            })
            .collect(),
    )
}

fn keyspaces_from_json(
    raw: Option<&JsonValue>,
) -> Result<BTreeMap<String, StoredWrappedKey>, JsonCodecError> {
    let Some(raw) = raw else {
        return Ok(BTreeMap::new());
    };
    let object = raw
        .as_object()
        .ok_or(JsonCodecError::ExpectedObject("keySpaces"))?;

    object
        .iter()
        .map(|(key_id, raw)| {
            let object = raw
                .as_object()
                .ok_or(JsonCodecError::ExpectedObject("keySpace"))?;
            let envelope = kernel_value_from_json(
                object
                    .get("envelope")
                    .ok_or(JsonCodecError::MissingField("envelope"))?,
            )?;
            let recipient_key_id =
                optional_string_from_json(object.get("recipientKeyId"), "recipientKeyId")?;
            Ok((
                key_id.clone(),
                StoredWrappedKey {
                    envelope,
                    recipient_key_id,
                },
            ))
        })
        .collect()
}

fn operators_to_json(operators: &BTreeMap<String, OperatorDefinition>) -> JsonValue {
    JsonValue::Object(
        operators
            .iter()
            .map(|(operator, definition)| {
                (
                    operator.clone(),
                    JsonValue::Object(Map::from_iter([(
                        "kind".to_string(),
                        JsonValue::String(definition.kind.clone()),
                    )])),
                )
            })
            .collect(),
    )
}

fn operators_from_json(
    raw: Option<&JsonValue>,
) -> Result<BTreeMap<String, OperatorDefinition>, JsonCodecError> {
    let Some(raw) = raw else {
        return Ok(BTreeMap::new());
    };
    let object = raw
        .as_object()
        .ok_or(JsonCodecError::ExpectedObject("operators"))?;

    object
        .iter()
        .map(|(operator, raw)| {
            let object = raw
                .as_object()
                .ok_or(JsonCodecError::ExpectedObject("operator"))?;
            let kind = object
                .get("kind")
                .and_then(JsonValue::as_str)
                .ok_or(JsonCodecError::ExpectedString("kind"))?
                .to_string();
            Ok((operator.clone(), OperatorDefinition { kind }))
        })
        .collect()
}

fn string_path_map_to_json(paths: &BTreeMap<Path, String>, value_key: &'static str) -> JsonValue {
    JsonValue::Array(
        paths
            .iter()
            .map(|(path, value)| {
                JsonValue::Object(Map::from_iter([
                    ("path".to_string(), path_to_json(path)),
                    (value_key.to_string(), JsonValue::String(value.clone())),
                ]))
            })
            .collect(),
    )
}

fn string_path_map_from_json(
    raw: Option<&JsonValue>,
    field: &'static str,
) -> Result<BTreeMap<Path, String>, JsonCodecError> {
    let Some(raw) = raw else {
        return Ok(BTreeMap::new());
    };
    if let Some(object) = raw.as_object() {
        return object
            .iter()
            .map(|(path, value)| {
                let value = value
                    .as_str()
                    .ok_or(JsonCodecError::ExpectedString(field))?
                    .to_string();
                Ok((path_from_string(path)?, value))
            })
            .collect();
    }

    let values = raw.as_array().ok_or(JsonCodecError::ExpectedArray(field))?;
    values
        .iter()
        .map(|entry| {
            let object = entry
                .as_object()
                .ok_or(JsonCodecError::ExpectedObject(field))?;
            let path = path_from_json(
                object
                    .get("path")
                    .ok_or(JsonCodecError::MissingField("path"))?,
                "path",
            )?;
            let value = object
                .get("secret")
                .or_else(|| object.get("noise"))
                .or_else(|| object.get("value"))
                .and_then(JsonValue::as_str)
                .ok_or(JsonCodecError::ExpectedString(field))?
                .to_string();
            Ok((path, value))
        })
        .collect()
}

fn path_value_map_to_json(values: &BTreeMap<Path, Value>) -> JsonValue {
    JsonValue::Object(
        values
            .iter()
            .map(|(path, value)| (path.join("."), kernel_value_to_json(value)))
            .collect(),
    )
}

fn paths_to_json(paths: &[Path]) -> JsonValue {
    JsonValue::Array(paths.iter().map(path_to_json).collect())
}

fn path_to_json(path: &Path) -> JsonValue {
    JsonValue::Array(
        path.iter()
            .map(|segment| JsonValue::String(segment.clone()))
            .collect(),
    )
}

fn path_from_json(raw: &JsonValue, field: &'static str) -> Result<Path, JsonCodecError> {
    match raw {
        JsonValue::String(value) => path_from_string(value),
        JsonValue::Array(values) => values
            .iter()
            .map(|value| {
                value
                    .as_str()
                    .map(str::to_string)
                    .ok_or(JsonCodecError::ExpectedString(field))
            })
            .collect(),
        _ => Err(JsonCodecError::ExpectedString(field)),
    }
}

fn path_from_string(value: &str) -> Result<Path, JsonCodecError> {
    value
        .into_path()
        .map_err(|_| JsonCodecError::InvalidPath(value.to_string()))
}

fn optional_string_to_json(value: Option<&str>) -> JsonValue {
    value
        .map(|value| JsonValue::String(value.to_string()))
        .unwrap_or(JsonValue::Null)
}

fn optional_string_from_json(
    raw: Option<&JsonValue>,
    field: &'static str,
) -> Result<Option<String>, JsonCodecError> {
    match raw {
        Some(JsonValue::Null) | None => Ok(None),
        Some(JsonValue::String(value)) => Ok(Some(value.clone())),
        Some(_) => Err(JsonCodecError::ExpectedString(field)),
    }
}

fn recompute_mode_to_string(mode: RecomputeMode) -> &'static str {
    match mode {
        RecomputeMode::Eager => "eager",
        RecomputeMode::Lazy => "lazy",
    }
}

fn bytes_to_json(bytes: &[u8]) -> JsonValue {
    JsonValue::Array(
        bytes
            .iter()
            .copied()
            .map(|byte| JsonValue::Number(serde_json::Number::from(byte)))
            .collect(),
    )
}
