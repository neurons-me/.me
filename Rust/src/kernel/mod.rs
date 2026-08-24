use std::collections::hash_map::DefaultHasher;
use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::fmt;
use std::hash::{Hash, Hasher};

mod evaluator;
mod path;

use evaluator::{evaluate_expression, extract_expression_refs, resolve_ref_path};
pub use path::{IntoPath, ParsedPath, Path, PathParseError, PathPart, Selector};

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Value>),
    Object(BTreeMap<String, Value>),
    Pointer(Path),
    Identity(String),
}

impl From<&str> for Value {
    fn from(value: &str) -> Self {
        Self::String(value.to_string())
    }
}

impl From<String> for Value {
    fn from(value: String) -> Self {
        Self::String(value)
    }
}

impl From<bool> for Value {
    fn from(value: bool) -> Self {
        Self::Bool(value)
    }
}

impl From<i64> for Value {
    fn from(value: i64) -> Self {
        Self::Number(value as f64)
    }
}

impl From<u64> for Value {
    fn from(value: u64) -> Self {
        Self::Number(value as f64)
    }
}

impl From<f64> for Value {
    fn from(value: f64) -> Self {
        Self::Number(value)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Memory {
    pub path: Path,
    pub operator: Option<String>,
    pub expression: Option<String>,
    pub value: Value,
    pub prev_hash: Option<String>,
    pub hash: String,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Snapshot {
    pub memories: Vec<Memory>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExplainResult {
    pub path: Path,
    pub value: Option<Value>,
    pub expr: Option<String>,
    pub derivation: Option<ExplainDerivation>,
    pub meta: ExplainMeta,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExplainDerivation {
    pub expression: String,
    pub inputs: Vec<ExplainInput>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExplainInput {
    pub label: String,
    pub path: Path,
    pub value: Option<Value>,
    pub origin: ExplainOrigin,
    pub masked: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExplainOrigin {
    Public,
    Secret,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExplainMeta {
    pub depends_on: Vec<Path>,
    pub resolved_path: Path,
    pub pointer_chain: Vec<Path>,
    pub secret: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KernelError {
    EmptyPath,
    EmptyExpression,
    EmptyNoise,
    EmptyQuery,
    EmptySecret,
    InvalidPath(PathParseError),
    InvalidIdentity(String),
    NonFiniteNumber,
    HydrationHashMismatch {
        path: Path,
        expected: String,
        actual: String,
    },
    HydrationChainMismatch {
        index: usize,
        expected_prev_hash: Option<String>,
        actual_prev_hash: Option<String>,
    },
}

impl fmt::Display for KernelError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyPath => write!(f, "path cannot be empty"),
            Self::EmptyExpression => write!(f, "expression cannot be empty"),
            Self::EmptyNoise => write!(f, "noise cannot be empty"),
            Self::EmptyQuery => write!(f, "query must contain at least one path"),
            Self::EmptySecret => write!(f, "secret cannot be empty"),
            Self::InvalidPath(error) => write!(f, "invalid path: {error}"),
            Self::InvalidIdentity(value) => write!(f, "invalid identity: {value}"),
            Self::NonFiniteNumber => write!(f, "numbers must be finite"),
            Self::HydrationHashMismatch {
                path,
                expected,
                actual,
            } => write!(
                f,
                "memory hash mismatch at {}: expected {}, got {}",
                path.join("."),
                expected,
                actual
            ),
            Self::HydrationChainMismatch {
                index,
                expected_prev_hash,
                actual_prev_hash,
            } => write!(
                f,
                "memory chain mismatch at index {}: expected prev_hash {:?}, got {:?}",
                index, expected_prev_hash, actual_prev_hash
            ),
        }
    }
}

impl std::error::Error for KernelError {}

#[derive(Debug, Clone, Default)]
pub struct Kernel {
    memories: Vec<Memory>,
    index: BTreeMap<Path, Value>,
    private_index: BTreeMap<Path, Value>,
    secret_scopes: BTreeSet<Path>,
    noise_scopes: BTreeSet<Path>,
    derivations: BTreeMap<Path, DerivationRecord>,
    ref_subscribers: BTreeMap<Path, BTreeSet<Path>>,
    active_identity: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DerivationRecord {
    eval_scope: Path,
    expression: String,
    refs: Vec<DerivationRef>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DerivationRef {
    label: String,
    path: Path,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct PointerResolution {
    resolved_path: Path,
    pointer_chain: Vec<Path>,
}

impl Kernel {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn memories(&self) -> &[Memory] {
        &self.memories
    }

    pub fn active_identity(&self) -> Option<&str> {
        self.active_identity.as_deref()
    }

    pub fn is_secret_scope(&self, path: impl IntoPath) -> bool {
        let Ok(path) = path.into_path() else {
            return false;
        };
        self.secret_scopes.contains(&path)
    }

    pub fn is_noise_scope(&self, path: impl IntoPath) -> bool {
        let Ok(path) = path.into_path() else {
            return false;
        };
        self.noise_scopes.contains(&path)
    }

    pub fn postulate(
        &mut self,
        path: impl IntoPath,
        value: impl Into<Value>,
    ) -> Result<&Memory, KernelError> {
        self.postulate_with_operator(path, None, value)
    }

    pub fn postulate_with_operator(
        &mut self,
        path: impl IntoPath,
        operator: Option<String>,
        value: impl Into<Value>,
    ) -> Result<&Memory, KernelError> {
        let path = path.into_path().map_err(KernelError::InvalidPath)?;
        if path.is_empty() {
            return Err(KernelError::EmptyPath);
        }

        self.commit_memory(path, operator, value.into())
    }

    pub fn remove(&mut self, path: impl IntoPath) -> Result<&Memory, KernelError> {
        self.postulate_with_operator(path, Some("-".to_string()), Value::Null)
    }

    pub fn derive(
        &mut self,
        scope: impl IntoPath,
        name: impl IntoPath,
        expression: &str,
    ) -> Result<&Memory, KernelError> {
        let eval_scope = scope.into_path().map_err(KernelError::InvalidPath)?;
        let name = name.into_path().map_err(KernelError::InvalidPath)?;
        let expression = expression.trim();

        if name.is_empty() {
            return Err(KernelError::EmptyPath);
        }
        if expression.is_empty() {
            return Err(KernelError::EmptyExpression);
        }

        let target_path = eval_scope.iter().cloned().chain(name).collect::<Vec<_>>();

        self.register_derivation(
            target_path.clone(),
            eval_scope.clone(),
            expression.to_string(),
        );

        let value = self
            .evaluate_expression(&eval_scope, expression)
            .unwrap_or_else(|| Value::String(expression.to_string()));

        self.commit_memory_with_expression(
            target_path,
            Some("=".to_string()),
            value,
            Some(expression.to_string()),
            true,
        )
    }

    pub fn collect<I, P>(&self, paths: I) -> Result<Value, KernelError>
    where
        I: IntoIterator<Item = P>,
        P: IntoPath,
    {
        self.collect_from_scope(&[], paths)
    }

    pub fn query<I, P>(
        &mut self,
        target_path: impl IntoPath,
        paths: I,
    ) -> Result<&Memory, KernelError>
    where
        I: IntoIterator<Item = P>,
        P: IntoPath,
    {
        let target_path = target_path.into_path().map_err(KernelError::InvalidPath)?;
        if target_path.is_empty() {
            return Err(KernelError::EmptyPath);
        }

        let value = self.collect_from_scope(&target_path, paths)?;
        self.commit_memory(target_path, Some("?".to_string()), value)
    }

    pub fn noise(&mut self, path: impl IntoPath, noise: &str) -> Result<&Memory, KernelError> {
        if noise.trim().is_empty() {
            return Err(KernelError::EmptyNoise);
        }

        let path = path.into_path().map_err(KernelError::InvalidPath)?;
        if path.is_empty() {
            return Err(KernelError::EmptyPath);
        }

        self.commit_memory(
            path,
            Some("~".to_string()),
            Value::String("***".to_string()),
        )
    }

    pub fn secret(&mut self, path: impl IntoPath, secret: &str) -> Result<&Memory, KernelError> {
        if secret.trim().is_empty() {
            return Err(KernelError::EmptySecret);
        }

        let path = path.into_path().map_err(KernelError::InvalidPath)?;
        if path.is_empty() {
            return Err(KernelError::EmptyPath);
        }

        self.commit_memory(
            path,
            Some("_".to_string()),
            Value::String("***".to_string()),
        )
    }

    pub fn pointer(
        &mut self,
        path: impl IntoPath,
        target: impl IntoPath,
    ) -> Result<&Memory, KernelError> {
        let target = target.into_path().map_err(KernelError::InvalidPath)?;
        if target.is_empty() {
            return Err(KernelError::EmptyPath);
        }
        self.postulate_with_operator(path, Some("__".to_string()), Value::Pointer(target))
    }

    pub fn claim_identity(&mut self, id: &str) -> Result<&Memory, KernelError> {
        let id = normalize_identity(id)?;
        self.active_identity = Some(id.clone());
        self.commit_memory(Vec::new(), Some("@".to_string()), Value::Identity(id))
    }

    pub fn identity(&mut self, path: impl IntoPath, id: &str) -> Result<&Memory, KernelError> {
        let id = normalize_identity(id)?;
        self.postulate_with_operator(path, Some("@".to_string()), Value::Identity(id))
    }

    pub fn read(&self, path: impl IntoPath) -> Option<&Value> {
        let Ok(path) = path.into_path() else {
            return None;
        };
        self.resolve_index_pointer_path(&path, 8)
            .and_then(|resolved| self.read_owner_path(&resolved))
    }

    pub fn read_public(&self, path: impl IntoPath) -> Option<&Value> {
        let Ok(path) = path.into_path() else {
            return None;
        };
        self.resolve_index_pointer_path(&path, 8)
            .and_then(|resolved| self.index.get(&resolved))
    }

    pub fn explain(&self, path: impl IntoPath) -> Result<ExplainResult, KernelError> {
        let path = path.into_path().map_err(KernelError::InvalidPath)?;
        let resolution = self
            .resolve_index_pointer_trace(&path, 8)
            .unwrap_or_else(|| PointerResolution {
                resolved_path: path.clone(),
                pointer_chain: Vec::new(),
            });
        let value = self.read_owner_path(&resolution.resolved_path).cloned();
        let record = self.derivations.get(&resolution.resolved_path);
        let derivation = record.map(|record| ExplainDerivation {
            expression: record.expression.clone(),
            inputs: record
                .refs
                .iter()
                .map(|reference| {
                    let masked = self.is_under_secret_scope(&reference.path);
                    ExplainInput {
                        label: reference.label.clone(),
                        path: reference.path.clone(),
                        value: if masked {
                            Some(Value::String("****".to_string()))
                        } else {
                            self.read(reference.path.clone()).cloned()
                        },
                        origin: if masked {
                            ExplainOrigin::Secret
                        } else {
                            ExplainOrigin::Public
                        },
                        masked,
                    }
                })
                .collect(),
        });
        let depends_on = record
            .map(|record| {
                record
                    .refs
                    .iter()
                    .map(|reference| reference.path.clone())
                    .collect()
            })
            .unwrap_or_default();
        let expr = record.map(|record| record.expression.clone());
        let secret = self.is_under_secret_scope(&resolution.resolved_path);

        Ok(ExplainResult {
            path,
            value,
            expr,
            meta: ExplainMeta {
                depends_on,
                resolved_path: resolution.resolved_path,
                pointer_chain: resolution.pointer_chain,
                secret,
            },
            derivation,
        })
    }

    pub fn export_snapshot(&self) -> Snapshot {
        Snapshot {
            memories: self.memories.clone(),
        }
    }

    pub fn hydrate(snapshot: Snapshot) -> Result<Self, KernelError> {
        let mut kernel = Self::new();
        let mut expected_prev_hash = None;

        for (index, memory) in snapshot.memories.into_iter().enumerate() {
            if memory.prev_hash != expected_prev_hash {
                return Err(KernelError::HydrationChainMismatch {
                    index,
                    expected_prev_hash,
                    actual_prev_hash: memory.prev_hash,
                });
            }

            let expected = hash_memory(
                &memory.path,
                memory.operator.as_deref(),
                memory.expression.as_deref(),
                &memory.value,
                memory.prev_hash.as_deref(),
            );
            if expected != memory.hash {
                return Err(KernelError::HydrationHashMismatch {
                    path: memory.path,
                    expected,
                    actual: memory.hash,
                });
            }

            if memory.operator.as_deref() == Some("=") {
                if let Some(expression) = memory.expression.clone() {
                    let eval_scope = parent_path(&memory.path);
                    kernel.register_derivation(memory.path.clone(), eval_scope, expression);
                }
            }
            kernel.apply_memory(&memory);
            expected_prev_hash = Some(memory.hash.clone());
            if memory.operator.as_deref() == Some("@") && memory.path.is_empty() {
                if let Value::Identity(id) = &memory.value {
                    kernel.active_identity = Some(id.clone());
                }
            }
            kernel.memories.push(memory);
        }

        Ok(kernel)
    }

    fn resolve_index_pointer_path(&self, path: &[String], max_hops: usize) -> Option<Path> {
        self.resolve_index_pointer_trace(path, max_hops)
            .map(|resolution| resolution.resolved_path)
    }

    fn resolve_index_pointer_trace(
        &self,
        path: &[String],
        max_hops: usize,
    ) -> Option<PointerResolution> {
        let mut current = path.to_vec();
        let mut visited = BTreeSet::new();
        let mut pointer_chain = Vec::new();

        for _ in 0..max_hops {
            if let Some(Value::Pointer(target)) = self.index.get(&current) {
                if !visited.insert(current.clone()) {
                    return None;
                }
                pointer_chain.push(current.clone());
                current = target.clone();
                continue;
            }

            let mut redirected = false;
            for prefix_len in (0..current.len()).rev() {
                let prefix = current[..prefix_len].to_vec();
                let Some(Value::Pointer(target)) = self.index.get(&prefix) else {
                    continue;
                };
                if !visited.insert(prefix.clone()) {
                    return None;
                }
                pointer_chain.push(prefix.clone());
                let suffix = current[prefix_len..].to_vec();
                current = target.iter().cloned().chain(suffix).collect();
                redirected = true;
                break;
            }

            if redirected {
                continue;
            }

            return Some(PointerResolution {
                resolved_path: current,
                pointer_chain,
            });
        }

        None
    }

    fn read_owner_path(&self, path: &[String]) -> Option<&Value> {
        if self.is_under_secret_scope(path) {
            return self.private_index.get(path);
        }
        self.index.get(path)
    }

    fn commit_memory(
        &mut self,
        path: Path,
        operator: Option<String>,
        value: Value,
    ) -> Result<&Memory, KernelError> {
        self.commit_memory_with_expression(path, operator, value, None, true)
    }

    fn commit_memory_with_expression(
        &mut self,
        path: Path,
        operator: Option<String>,
        value: Value,
        expression: Option<String>,
        invalidate: bool,
    ) -> Result<&Memory, KernelError> {
        ensure_value_is_supported(&value)?;

        let prev_hash = self.memories.last().map(|memory| memory.hash.clone());
        let hash = hash_memory(
            &path,
            operator.as_deref(),
            expression.as_deref(),
            &value,
            prev_hash.as_deref(),
        );
        let source_path = path.clone();
        let memory_index = self.memories.len();
        let memory = Memory {
            path,
            operator,
            expression,
            value,
            prev_hash,
            hash,
        };

        self.apply_memory(&memory);
        self.memories.push(memory);
        if invalidate {
            self.invalidate_from_path(&source_path);
        }
        Ok(&self.memories[memory_index])
    }

    fn apply_memory(&mut self, memory: &Memory) {
        match memory.operator.as_deref() {
            Some("_") => {
                self.secret_scopes.insert(memory.path.clone());
                move_index_prefix_to_private(
                    &mut self.index,
                    &mut self.private_index,
                    &memory.path,
                );
            }
            Some("~") => {
                self.noise_scopes.insert(memory.path.clone());
            }
            Some("-") => {
                remove_index_prefix(&mut self.index, &memory.path);
                remove_index_prefix(&mut self.private_index, &memory.path);
                self.secret_scopes
                    .retain(|scope| !path_starts_with(scope, &memory.path));
                self.noise_scopes
                    .retain(|scope| !path_starts_with(scope, &memory.path));
                self.clear_derivations_by_prefix(&memory.path);
            }
            _ if self.is_under_secret_scope(&memory.path) => {
                self.index.remove(&memory.path);
                self.private_index
                    .insert(memory.path.clone(), memory.value.clone());
            }
            _ => {
                self.index.insert(memory.path.clone(), memory.value.clone());
            }
        }
    }

    fn is_under_secret_scope(&self, path: &[String]) -> bool {
        self.secret_scopes
            .iter()
            .any(|scope| path_starts_with(path, scope))
    }

    fn register_derivation(&mut self, target_path: Path, eval_scope: Path, expression: String) {
        self.unregister_derivation(&target_path);

        let mut seen = BTreeSet::new();
        let refs = extract_expression_refs(&expression)
            .into_iter()
            .filter_map(|label| {
                let path = resolve_ref_path(&label, &eval_scope)?;
                seen.insert(path.clone())
                    .then_some(DerivationRef { label, path })
            })
            .collect::<Vec<_>>();

        for reference in &refs {
            self.ref_subscribers
                .entry(reference.path.clone())
                .or_default()
                .insert(target_path.clone());
        }

        self.derivations.insert(
            target_path,
            DerivationRecord {
                eval_scope,
                expression,
                refs,
            },
        );
    }

    fn unregister_derivation(&mut self, target_path: &[String]) {
        let Some(record) = self.derivations.remove(target_path) else {
            return;
        };

        for reference in record.refs {
            if let Some(subscribers) = self.ref_subscribers.get_mut(&reference.path) {
                subscribers.remove(target_path);
                if subscribers.is_empty() {
                    self.ref_subscribers.remove(&reference.path);
                }
            }
        }
    }

    fn clear_derivations_by_prefix(&mut self, prefix: &[String]) {
        let targets = self
            .derivations
            .keys()
            .filter(|target| path_starts_with(target, prefix))
            .cloned()
            .collect::<Vec<_>>();

        for target in targets {
            self.unregister_derivation(&target);
        }
    }

    fn invalidate_from_path(&mut self, source_path: &[String]) {
        let mut queue = VecDeque::from([source_path.to_vec()]);
        let mut seen_targets = BTreeSet::new();

        while let Some(changed_path) = queue.pop_front() {
            let subscribers = self
                .ref_subscribers
                .get(&changed_path)
                .cloned()
                .unwrap_or_default();

            for target_path in subscribers {
                if !seen_targets.insert(target_path.clone()) {
                    continue;
                }
                if self.recompute_target(&target_path) {
                    queue.push_back(target_path);
                }
            }
        }
    }

    fn recompute_target(&mut self, target_path: &[String]) -> bool {
        let Some(record) = self.derivations.get(target_path).cloned() else {
            return false;
        };

        let value = self
            .evaluate_expression(&record.eval_scope, &record.expression)
            .unwrap_or_else(|| Value::String(record.expression.clone()));

        self.commit_memory_with_expression(
            target_path.to_vec(),
            Some("=".to_string()),
            value,
            Some(record.expression),
            false,
        )
        .is_ok()
    }

    fn evaluate_expression(&self, eval_scope: &[String], expression: &str) -> Option<Value> {
        evaluate_expression(self, eval_scope, expression)
    }

    fn collect_from_scope<I, P>(&self, scope: &[String], paths: I) -> Result<Value, KernelError>
    where
        I: IntoIterator<Item = P>,
        P: IntoPath,
    {
        let mut values = Vec::new();

        for path in paths {
            let path = path.into_path().map_err(KernelError::InvalidPath)?;
            if path.is_empty() {
                return Err(KernelError::EmptyPath);
            }
            let path = resolve_query_path(scope, path);
            values.push(self.read(path).cloned().unwrap_or(Value::Null));
        }

        if values.is_empty() {
            return Err(KernelError::EmptyQuery);
        }

        Ok(Value::Array(values))
    }
}

fn remove_index_prefix(index: &mut BTreeMap<Path, Value>, prefix: &[String]) {
    index.retain(|path, _| !path_starts_with(path, prefix));
}

fn move_index_prefix_to_private(
    index: &mut BTreeMap<Path, Value>,
    private_index: &mut BTreeMap<Path, Value>,
    prefix: &[String],
) {
    let keys = index
        .keys()
        .filter(|path| path_starts_with(path, prefix))
        .cloned()
        .collect::<Vec<_>>();

    for key in keys {
        if let Some(value) = index.remove(&key) {
            private_index.insert(key, value);
        }
    }
}

fn path_starts_with(path: &[String], prefix: &[String]) -> bool {
    path.len() >= prefix.len() && path.iter().zip(prefix).all(|(left, right)| left == right)
}

fn parent_path(path: &[String]) -> Path {
    path.split_last()
        .map(|(_, parent)| parent.to_vec())
        .unwrap_or_default()
}

fn resolve_query_path(scope: &[String], path: Path) -> Path {
    if scope.is_empty() || path.len() != 1 {
        return path;
    }
    scope.iter().cloned().chain(path).collect()
}

fn ensure_value_is_supported(value: &Value) -> Result<(), KernelError> {
    match value {
        Value::Number(number) if !number.is_finite() => Err(KernelError::NonFiniteNumber),
        Value::Array(values) => {
            for value in values {
                ensure_value_is_supported(value)?;
            }
            Ok(())
        }
        Value::Object(values) => {
            for value in values.values() {
                ensure_value_is_supported(value)?;
            }
            Ok(())
        }
        Value::Pointer(path) if path.is_empty() => Err(KernelError::EmptyPath),
        Value::Identity(id) => normalize_identity(id).map(|_| ()),
        _ => Ok(()),
    }
}

fn normalize_identity(input: &str) -> Result<String, KernelError> {
    let id = input.trim().to_ascii_lowercase();
    if id.len() < 3 || id.len() > 63 {
        return Err(KernelError::InvalidIdentity(input.to_string()));
    }
    if id.contains('.') {
        return Err(KernelError::InvalidIdentity(input.to_string()));
    }

    let bytes = id.as_bytes();
    let is_label_char =
        |byte: u8| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-';
    let is_edge_char = |byte: u8| byte.is_ascii_lowercase() || byte.is_ascii_digit();

    if !bytes.iter().copied().all(is_label_char) {
        return Err(KernelError::InvalidIdentity(input.to_string()));
    }
    if !is_edge_char(bytes[0]) || !is_edge_char(bytes[bytes.len() - 1]) {
        return Err(KernelError::InvalidIdentity(input.to_string()));
    }

    Ok(id)
}

fn hash_memory(
    path: &[String],
    operator: Option<&str>,
    expression: Option<&str>,
    value: &Value,
    prev_hash: Option<&str>,
) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    operator.hash(&mut hasher);
    expression.hash(&mut hasher);
    hash_value(value, &mut hasher);
    prev_hash.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn hash_value(value: &Value, state: &mut DefaultHasher) {
    match value {
        Value::Null => 0_u8.hash(state),
        Value::Bool(value) => {
            1_u8.hash(state);
            value.hash(state);
        }
        Value::Number(value) => {
            2_u8.hash(state);
            value.to_bits().hash(state);
        }
        Value::String(value) => {
            3_u8.hash(state);
            value.hash(state);
        }
        Value::Array(values) => {
            4_u8.hash(state);
            values.len().hash(state);
            for value in values {
                hash_value(value, state);
            }
        }
        Value::Object(values) => {
            5_u8.hash(state);
            values.len().hash(state);
            for (key, value) in values {
                key.hash(state);
                hash_value(value, state);
            }
        }
        Value::Pointer(path) => {
            6_u8.hash(state);
            path.hash(state);
        }
        Value::Identity(id) => {
            7_u8.hash(state);
            id.hash(state);
        }
    }
}
