use std::collections::BTreeMap;
use std::fmt;

use super::{
    path_starts_with, ExplainResult, InspectMemory, InspectResult, IntoPath, Kernel, KernelError,
    Memory, Path, RecomputeMode, Snapshot, Value,
};

#[derive(Debug, Clone, PartialEq)]
pub struct MeTargetAst {
    pub scheme: String,
    pub namespace: String,
    pub operation: String,
    pub path: String,
    pub raw: Option<String>,
    pub context_raw: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ExecuteValue {
    None,
    Value(Value),
    Memories(Vec<Memory>),
    Snapshot(Snapshot),
    Inspect(InspectResult),
    Explain(ExplainResult),
    Mode(RecomputeMode),
}

#[derive(Debug, Clone, PartialEq)]
pub enum ExecuteError {
    Kernel(KernelError),
    EmptyTarget,
    InvalidTarget(String),
    MissingNamespace(String),
    MissingNamespaceBeforeContext(String),
    MissingOperation(String),
    MalformedContext(String),
    MissingBody(&'static str),
    InvalidBody(&'static str),
    UnsupportedNamespace(String),
    UnsupportedSelfOperation(String),
    UnsupportedKernelOperation(String),
    UnsupportedKernelPath { operation: String, path: String },
    SelfWriteRequiresPath,
    SelfExplainRequiresPath,
}

impl fmt::Display for ExecuteError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Kernel(error) => write!(f, "{error}"),
            Self::EmptyTarget => write!(f, "execute(...) received an empty me target"),
            Self::InvalidTarget(target) => write!(
                f,
                "invalid me target \"{target}\": expected \":\" between namespace and operation"
            ),
            Self::MissingNamespace(target) => {
                write!(f, "invalid me target \"{target}\": missing namespace")
            }
            Self::MissingNamespaceBeforeContext(target) => write!(
                f,
                "invalid me target \"{target}\": missing namespace before context"
            ),
            Self::MissingOperation(target) => {
                write!(f, "invalid me target \"{target}\": missing operation")
            }
            Self::MalformedContext(target) => {
                write!(f, "invalid me target \"{target}\": malformed context segment")
            }
            Self::MissingBody(message) => write!(f, "{message}"),
            Self::InvalidBody(message) => write!(f, "{message}"),
            Self::UnsupportedNamespace(namespace) => write!(
                f,
                "external me target \"{namespace}\" must be resolved by cleaker or monad.ai before reaching the local kernel"
            ),
            Self::UnsupportedSelfOperation(operation) => {
                write!(f, "unsupported self operation: {operation}")
            }
            Self::UnsupportedKernelOperation(operation) => {
                write!(f, "unsupported kernel operation: {operation}")
            }
            Self::UnsupportedKernelPath { operation, path } => write!(
                f,
                "unsupported kernel:{operation} path: {}",
                if path.is_empty() { "<root>" } else { path }
            ),
            Self::SelfWriteRequiresPath => write!(f, "self:write requires a semantic path"),
            Self::SelfExplainRequiresPath => write!(f, "self:explain requires a semantic path"),
        }
    }
}

impl std::error::Error for ExecuteError {}

impl From<KernelError> for ExecuteError {
    fn from(error: KernelError) -> Self {
        Self::Kernel(error)
    }
}

impl From<Value> for ExecuteValue {
    fn from(value: Value) -> Self {
        Self::Value(value)
    }
}

impl From<&str> for ExecuteValue {
    fn from(value: &str) -> Self {
        Self::Value(Value::from(value))
    }
}

impl From<String> for ExecuteValue {
    fn from(value: String) -> Self {
        Self::Value(Value::from(value))
    }
}

impl From<bool> for ExecuteValue {
    fn from(value: bool) -> Self {
        Self::Value(Value::from(value))
    }
}

impl From<u64> for ExecuteValue {
    fn from(value: u64) -> Self {
        Self::Value(Value::from(value))
    }
}

impl From<i64> for ExecuteValue {
    fn from(value: i64) -> Self {
        Self::Value(Value::from(value))
    }
}

impl From<f64> for ExecuteValue {
    fn from(value: f64) -> Self {
        Self::Value(Value::from(value))
    }
}

impl Kernel {
    pub fn execute(
        &mut self,
        raw_target: impl AsRef<str>,
        body: Option<ExecuteValue>,
    ) -> Result<ExecuteValue, ExecuteError> {
        let target = parse_executable_target(raw_target.as_ref())?;

        match target.namespace.as_str() {
            "self" => self.handle_self_target(&target.operation, &target.path, body),
            "kernel" => self.handle_kernel_target(&target.operation, &target.path, body),
            namespace => Err(ExecuteError::UnsupportedNamespace(namespace.to_string())),
        }
    }

    pub fn execute_ast(
        &mut self,
        target: MeTargetAst,
        body: Option<ExecuteValue>,
    ) -> Result<ExecuteValue, ExecuteError> {
        if target.namespace.trim().is_empty() {
            return Err(ExecuteError::MissingNamespace(
                target.raw.unwrap_or_else(|| "<ast>".to_string()),
            ));
        }
        if target.operation.trim().is_empty() {
            return Err(ExecuteError::MissingOperation(
                target.raw.unwrap_or_else(|| "<ast>".to_string()),
            ));
        }

        let namespace = target.namespace.trim().to_string();
        let operation = target.operation.trim().to_ascii_lowercase();
        match namespace.as_str() {
            "self" => self.handle_self_target(&operation, target.path.trim(), body),
            "kernel" => self.handle_kernel_target(&operation, target.path.trim(), body),
            namespace => Err(ExecuteError::UnsupportedNamespace(namespace.to_string())),
        }
    }

    fn handle_self_target(
        &mut self,
        operation: &str,
        raw_path: &str,
        body: Option<ExecuteValue>,
    ) -> Result<ExecuteValue, ExecuteError> {
        let path = normalize_executable_path_inner(raw_path)?;

        match operation {
            "read" => Ok(self
                .read(path.parts)
                .cloned()
                .map(ExecuteValue::Value)
                .unwrap_or(ExecuteValue::None)),
            "write" => {
                if path.parts.is_empty() {
                    return Err(ExecuteError::SelfWriteRequiresPath);
                }
                let value = expect_value_body(body, "self:write requires a body payload")?;
                self.postulate(path.parts, value.clone())?;
                Ok(ExecuteValue::Value(value))
            }
            "inspect" => Ok(ExecuteValue::Inspect(self.inspect_at_path(&path.parts))),
            "explain" => {
                if path.parts.is_empty() {
                    return Err(ExecuteError::SelfExplainRequiresPath);
                }
                Ok(ExecuteValue::Explain(self.explain(path.parts)?))
            }
            operation => Err(ExecuteError::UnsupportedSelfOperation(
                operation.to_string(),
            )),
        }
    }

    fn handle_kernel_target(
        &mut self,
        operation: &str,
        raw_path: &str,
        body: Option<ExecuteValue>,
    ) -> Result<ExecuteValue, ExecuteError> {
        let path = normalize_executable_path_inner(raw_path)?;
        let key = path.key;

        match operation {
            "read" => self.handle_kernel_read(&key),
            "export" => self.handle_kernel_export(&key),
            "import" => {
                let snapshot = expect_snapshot_body(body, "kernel:import requires a payload")?;
                *self = Kernel::hydrate(snapshot)?;
                Ok(ExecuteValue::Snapshot(self.export_snapshot()))
            }
            "hydrate" => {
                let snapshot = expect_snapshot_body(body, "kernel:hydrate requires a payload")?;
                *self = Kernel::hydrate(snapshot)?;
                Ok(ExecuteValue::Snapshot(self.export_snapshot()))
            }
            "replay" => {
                let memories = expect_memories_body(body, "kernel:replay requires a payload")?;
                self.replay_memories(memories)?;
                Ok(ExecuteValue::Memories(self.memories().to_vec()))
            }
            "rehydrate" => {
                let snapshot = expect_snapshot_body(body, "kernel:rehydrate requires a payload")?;
                *self = Kernel::hydrate(snapshot)?;
                Ok(ExecuteValue::Snapshot(self.export_snapshot()))
            }
            "get" => self.handle_kernel_get(&key),
            "set" => self.handle_kernel_set(&key, body),
            operation => Err(ExecuteError::UnsupportedKernelOperation(
                operation.to_string(),
            )),
        }
    }

    fn handle_kernel_read(&self, key: &str) -> Result<ExecuteValue, ExecuteError> {
        match key {
            "memory" | "memories" | "logs" => Ok(ExecuteValue::Memories(self.memories().to_vec())),
            "snapshot" => Ok(ExecuteValue::Snapshot(self.export_snapshot())),
            "mode" | "recompute.mode" => Ok(ExecuteValue::Mode(self.recompute_mode())),
            _ => Err(ExecuteError::UnsupportedKernelPath {
                operation: "read".to_string(),
                path: key.to_string(),
            }),
        }
    }

    fn handle_kernel_export(&self, key: &str) -> Result<ExecuteValue, ExecuteError> {
        match key {
            "memory" | "memories" | "logs" => Ok(ExecuteValue::Memories(self.memories().to_vec())),
            "snapshot" => Ok(ExecuteValue::Snapshot(self.export_snapshot())),
            _ => Err(ExecuteError::UnsupportedKernelPath {
                operation: "export".to_string(),
                path: key.to_string(),
            }),
        }
    }

    fn handle_kernel_get(&self, key: &str) -> Result<ExecuteValue, ExecuteError> {
        match key {
            "mode" | "recompute.mode" => Ok(ExecuteValue::Mode(self.recompute_mode())),
            _ => Err(ExecuteError::UnsupportedKernelPath {
                operation: "get".to_string(),
                path: key.to_string(),
            }),
        }
    }

    fn handle_kernel_set(
        &mut self,
        key: &str,
        body: Option<ExecuteValue>,
    ) -> Result<ExecuteValue, ExecuteError> {
        match key {
            "mode" | "recompute.mode" => {
                let mode = expect_recompute_mode_body(body)?;
                self.set_recompute_mode(mode);
                Ok(ExecuteValue::Mode(self.recompute_mode()))
            }
            _ => Err(ExecuteError::UnsupportedKernelPath {
                operation: "set".to_string(),
                path: key.to_string(),
            }),
        }
    }

    fn inspect_at_path(&self, scope: &[String]) -> InspectResult {
        if scope.is_empty() {
            return self.inspect();
        }

        let snapshot = self.inspect();
        InspectResult {
            memories: snapshot
                .memories
                .into_iter()
                .filter(|memory| matches_scope(&memory.path, scope))
                .collect::<Vec<InspectMemory>>(),
            index: snapshot
                .index
                .into_iter()
                .filter(|(path, _)| matches_scope(path, scope))
                .collect::<BTreeMap<Path, Value>>(),
            secret_scopes: snapshot
                .secret_scopes
                .into_iter()
                .filter(|path| matches_scope(path, scope))
                .collect(),
            noise_scopes: snapshot
                .noise_scopes
                .into_iter()
                .filter(|path| matches_scope(path, scope))
                .collect(),
            derivations: snapshot
                .derivations
                .into_iter()
                .filter(|path| matches_scope(path, scope))
                .collect(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ExecutablePath {
    key: String,
    parts: Path,
}

pub fn parse_executable_target(raw_target: &str) -> Result<MeTargetAst, ExecuteError> {
    let raw = raw_target.trim();
    if raw.is_empty() {
        return Err(ExecuteError::EmptyTarget);
    }

    let without_scheme = raw.strip_prefix("me://").unwrap_or(raw);
    let Some(colon_index) = find_top_level_colon(without_scheme) else {
        return Err(ExecuteError::InvalidTarget(raw.to_string()));
    };

    let namespace_with_context = without_scheme[..colon_index].trim();
    let rhs = without_scheme[colon_index + 1..].trim();
    if namespace_with_context.is_empty() {
        return Err(ExecuteError::MissingNamespace(raw.to_string()));
    }
    if rhs.is_empty() {
        return Err(ExecuteError::MissingOperation(raw.to_string()));
    }

    let slash_index = rhs.find('/');
    let operation = slash_index
        .map(|index| &rhs[..index])
        .unwrap_or(rhs)
        .trim()
        .to_ascii_lowercase();
    let path = slash_index
        .map(|index| &rhs[index + 1..])
        .unwrap_or("")
        .trim()
        .to_string();
    if operation.is_empty() {
        return Err(ExecuteError::MissingOperation(raw.to_string()));
    }

    let (namespace, context_raw) = split_target_namespace(namespace_with_context, raw)?;
    Ok(MeTargetAst {
        scheme: "me".to_string(),
        namespace,
        operation,
        path,
        raw: Some(raw.to_string()),
        context_raw,
    })
}

pub fn normalize_executable_path(raw_path: &str) -> Result<(String, Path), ExecuteError> {
    let path = normalize_executable_path_inner(raw_path)?;
    Ok((path.key, path.parts))
}

fn normalize_executable_path_inner(raw_path: &str) -> Result<ExecutablePath, ExecuteError> {
    let dotted = raw_path
        .trim()
        .trim_matches('/')
        .replace('/', ".")
        .trim()
        .to_string();
    if dotted.is_empty() {
        return Ok(ExecutablePath {
            key: String::new(),
            parts: Vec::new(),
        });
    }
    let parts = dotted.into_path().map_err(KernelError::InvalidPath)?;
    Ok(ExecutablePath {
        key: parts.join("."),
        parts,
    })
}

fn split_target_namespace(
    namespace_with_context: &str,
    raw_target: &str,
) -> Result<(String, Option<String>), ExecuteError> {
    let Some(open_index) = namespace_with_context.find('[') else {
        return Ok((namespace_with_context.to_string(), None));
    };

    let close_index = namespace_with_context.rfind(']');
    if close_index
        .is_none_or(|index| index < open_index || index != namespace_with_context.len() - 1)
    {
        return Err(ExecuteError::MalformedContext(raw_target.to_string()));
    }
    let close_index = close_index.expect("checked above");
    let namespace = namespace_with_context[..open_index].trim();
    if namespace.is_empty() {
        return Err(ExecuteError::MissingNamespaceBeforeContext(
            raw_target.to_string(),
        ));
    }
    let context_raw = namespace_with_context[open_index + 1..close_index].trim();
    Ok((
        namespace.to_string(),
        (!context_raw.is_empty()).then(|| context_raw.to_string()),
    ))
}

fn find_top_level_colon(value: &str) -> Option<usize> {
    let mut bracket_depth = 0_u32;
    let mut quote = None;
    let mut escaped = false;

    for (index, ch) in value.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if let Some(expected_quote) = quote {
            if ch == '\\' {
                escaped = true;
            } else if ch == expected_quote {
                quote = None;
            }
            continue;
        }

        match ch {
            '"' | '\'' => quote = Some(ch),
            '[' => bracket_depth += 1,
            ']' => bracket_depth = bracket_depth.saturating_sub(1),
            ':' if bracket_depth == 0 => return Some(index),
            _ => {}
        }
    }

    None
}

fn expect_value_body(
    body: Option<ExecuteValue>,
    missing_message: &'static str,
) -> Result<Value, ExecuteError> {
    match body {
        Some(ExecuteValue::Value(value)) => Ok(value),
        None => Err(ExecuteError::MissingBody(missing_message)),
        _ => Err(ExecuteError::InvalidBody(
            "expected a semantic value payload",
        )),
    }
}

fn expect_snapshot_body(
    body: Option<ExecuteValue>,
    missing_message: &'static str,
) -> Result<Snapshot, ExecuteError> {
    match body {
        Some(ExecuteValue::Snapshot(snapshot)) => Ok(snapshot),
        None => Err(ExecuteError::MissingBody(missing_message)),
        _ => Err(ExecuteError::InvalidBody("expected a snapshot payload")),
    }
}

fn expect_memories_body(
    body: Option<ExecuteValue>,
    missing_message: &'static str,
) -> Result<Vec<Memory>, ExecuteError> {
    match body {
        Some(ExecuteValue::Memories(memories)) => Ok(memories),
        None => Err(ExecuteError::MissingBody(missing_message)),
        _ => Err(ExecuteError::InvalidBody("expected a memory log payload")),
    }
}

fn expect_recompute_mode_body(body: Option<ExecuteValue>) -> Result<RecomputeMode, ExecuteError> {
    match body {
        Some(ExecuteValue::Mode(mode)) => Ok(mode),
        Some(ExecuteValue::Value(Value::String(mode))) if mode == "eager" => {
            Ok(RecomputeMode::Eager)
        }
        Some(ExecuteValue::Value(Value::String(mode))) if mode == "lazy" => Ok(RecomputeMode::Lazy),
        None => Err(ExecuteError::MissingBody("kernel:set requires a payload")),
        _ => Err(ExecuteError::InvalidBody(
            "kernel:set/recompute.mode only accepts \"eager\" or \"lazy\"",
        )),
    }
}

fn matches_scope(candidate: &[String], scope: &[String]) -> bool {
    candidate == scope || path_starts_with(candidate, scope)
}
