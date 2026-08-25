use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::fmt;

mod evaluator;
mod path;
mod secret_material;

use evaluator::{evaluate_expression, extract_expression_refs, resolve_ref_path};
pub use path::{IntoPath, ParsedPath, Path, PathParseError, PathPart, Selector};
use secret_material::{
    decrypt_blob_v3_cleartext, derive_blob_v3_keys, derive_secret_material_v3,
    encrypt_blob_v3_cleartext, lineage_segment, random_blob_v3_nonce,
};
pub use secret_material::{BlobV3DerivedKeys, SecretMaterialPurpose};

const V3_DOMAIN: &str = "this.me/blob/v3";
const V3_NO_NOISE_SENTINEL: &str = "this.me/blob/v3/no-noise";

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
    pub expression: Option<Value>,
    pub value: Value,
    pub prev_hash: Option<String>,
    pub hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperatorDefinition {
    pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Snapshot {
    pub memories: Vec<Memory>,
    pub local_secrets: BTreeMap<Path, String>,
    pub local_noises: BTreeMap<Path, String>,
    pub operators: BTreeMap<String, OperatorDefinition>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct InspectResult {
    pub memories: Vec<InspectMemory>,
    pub index: BTreeMap<Path, Value>,
    pub secret_scopes: Vec<Path>,
    pub noise_scopes: Vec<Path>,
    pub derivations: Vec<Path>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct InspectMemory {
    pub path: Path,
    pub operator: Option<String>,
    pub expression: Option<Value>,
    pub value: Value,
    pub prev_hash: Option<String>,
    pub hash: String,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecretMaterialMode {
    Branch,
    Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecomputeMode {
    Eager,
    Lazy,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExplainMeta {
    pub depends_on: Vec<Path>,
    pub resolved_path: Path,
    pub pointer_chain: Vec<Path>,
    pub secret: bool,
    pub k: usize,
    pub recomputed: Vec<Path>,
    pub source_path: Option<Path>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KernelError {
    EmptyPath,
    EmptyExpression,
    EmptyNoise,
    EmptyOperator,
    EmptyOperatorKind,
    EmptyQuery,
    EmptySecret,
    InvalidPath(PathParseError),
    InvalidIdentity(String),
    NonFiniteNumber,
    NoSecretContext(Path),
    RandomUnavailable,
    ReservedOperator(String),
    SecretBlobDecryptFailed(Path),
    RootSecretBranchUnsupported,
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
            Self::EmptyOperator => write!(f, "operator cannot be empty"),
            Self::EmptyOperatorKind => write!(f, "operator kind cannot be empty"),
            Self::EmptyQuery => write!(f, "query must contain at least one path"),
            Self::EmptySecret => write!(f, "secret cannot be empty"),
            Self::InvalidPath(error) => write!(f, "invalid path: {error}"),
            Self::InvalidIdentity(value) => write!(f, "invalid identity: {value}"),
            Self::NonFiniteNumber => write!(f, "numbers must be finite"),
            Self::NoSecretContext(path) => write!(
                f,
                "no secret context active for {}",
                if path.is_empty() {
                    "<root>".to_string()
                } else {
                    path.join(".")
                }
            ),
            Self::RandomUnavailable => write!(f, "secure random bytes are unavailable"),
            Self::ReservedOperator(operator) => {
                write!(f, "operator {operator} is reserved")
            }
            Self::SecretBlobDecryptFailed(path) => write!(
                f,
                "secret blob decrypt failed for {}",
                if path.is_empty() {
                    "<root>".to_string()
                } else {
                    path.join(".")
                }
            ),
            Self::RootSecretBranchUnsupported => {
                write!(f, "branch v3 derivation does not support root secret scope")
            }
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

#[derive(Debug, Clone)]
pub struct Kernel {
    memories: Vec<Memory>,
    index: BTreeMap<Path, Value>,
    private_index: BTreeMap<Path, Value>,
    secret_scopes: BTreeSet<Path>,
    noise_scopes: BTreeSet<Path>,
    local_secrets: BTreeMap<Path, String>,
    local_noises: BTreeMap<Path, String>,
    derivations: BTreeMap<Path, DerivationRecord>,
    ref_subscribers: BTreeMap<Path, BTreeSet<Path>>,
    active_identity: Option<String>,
    operators: BTreeMap<String, OperatorDefinition>,
    last_recompute_wave_by_target: BTreeMap<Path, RecomputeWave>,
    active_recompute_wave: Option<RecomputeWave>,
    recompute_mode: RecomputeMode,
    stale_derivations: BTreeSet<Path>,
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
struct RecomputeWave {
    source_path: Path,
    recomputed: BTreeSet<Path>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct PointerResolution {
    resolved_path: Path,
    pointer_chain: Vec<Path>,
}

impl Default for Kernel {
    fn default() -> Self {
        Self {
            memories: Vec::new(),
            index: BTreeMap::new(),
            private_index: BTreeMap::new(),
            secret_scopes: BTreeSet::new(),
            noise_scopes: BTreeSet::new(),
            local_secrets: BTreeMap::new(),
            local_noises: BTreeMap::new(),
            derivations: BTreeMap::new(),
            ref_subscribers: BTreeMap::new(),
            active_identity: None,
            operators: default_operators(),
            last_recompute_wave_by_target: BTreeMap::new(),
            active_recompute_wave: None,
            recompute_mode: RecomputeMode::Eager,
            stale_derivations: BTreeSet::new(),
        }
    }
}

impl Kernel {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn memories(&self) -> &[Memory] {
        &self.memories
    }

    pub fn inspect(&self) -> InspectResult {
        self.inspect_memories(self.memories.iter())
    }

    pub fn inspect_last(&self, last: usize) -> InspectResult {
        if last == 0 || last >= self.memories.len() {
            return self.inspect();
        }
        self.inspect_memories(self.memories[self.memories.len() - last..].iter())
    }

    pub fn active_identity(&self) -> Option<&str> {
        self.active_identity.as_deref()
    }

    pub fn operators(&self) -> &BTreeMap<String, OperatorDefinition> {
        &self.operators
    }

    pub fn operator_kind(&self, operator: &str) -> Option<&str> {
        self.operators
            .get(operator)
            .map(|definition| definition.kind.as_str())
    }

    pub fn recompute_mode(&self) -> RecomputeMode {
        self.recompute_mode
    }

    pub fn set_recompute_mode(&mut self, mode: RecomputeMode) -> &mut Self {
        self.recompute_mode = mode;
        self
    }

    pub fn define_operator(&mut self, operator: &str, kind: &str) -> Result<(), KernelError> {
        let operator = operator.trim();
        let kind = kind.trim();

        if operator.is_empty() {
            return Err(KernelError::EmptyOperator);
        }
        if operator == "+" {
            return Err(KernelError::ReservedOperator(operator.to_string()));
        }
        if kind.is_empty() {
            return Err(KernelError::EmptyOperatorKind);
        }

        self.operators.insert(
            operator.to_string(),
            OperatorDefinition {
                kind: kind.to_string(),
            },
        );
        Ok(())
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

    pub fn effective_secret(&self, path: impl IntoPath) -> Result<String, KernelError> {
        let path = path.into_path().map_err(KernelError::InvalidPath)?;
        Ok(self.compute_effective_secret(&path))
    }

    pub fn secret_material_v3(
        &self,
        path: impl IntoPath,
        mode: SecretMaterialMode,
        purpose: SecretMaterialPurpose,
    ) -> Result<[u8; 32], KernelError> {
        let path = path.into_path().map_err(KernelError::InvalidPath)?;
        let chain = self.collect_secret_chain_v3(&path, mode)?;
        derive_secret_material_v3(&chain, purpose).ok_or(KernelError::NoSecretContext(path))
    }

    pub fn secret_blob_keys_v3(
        &self,
        path: impl IntoPath,
        mode: SecretMaterialMode,
    ) -> Result<BlobV3DerivedKeys, KernelError> {
        let path = path.into_path().map_err(KernelError::InvalidPath)?;
        let chain = self.collect_secret_chain_v3(&path, mode)?;
        let purpose = match mode {
            SecretMaterialMode::Branch => SecretMaterialPurpose::Branch,
            SecretMaterialMode::Value => SecretMaterialPurpose::Value,
        };
        derive_blob_v3_keys(&chain, purpose, &path).ok_or(KernelError::NoSecretContext(path))
    }

    pub fn encrypt_secret_value_v3(
        &self,
        path: impl IntoPath,
        value: impl Into<Value>,
        nonce: [u8; 16],
    ) -> Result<String, KernelError> {
        let path = path.into_path().map_err(KernelError::InvalidPath)?;
        let keys = self.secret_blob_keys_v3(path.clone(), SecretMaterialMode::Value)?;
        let value = value.into();
        ensure_value_is_supported(&value)?;
        let mut json = String::new();
        push_json_value(&mut json, &value);
        Ok(encrypt_blob_v3_cleartext(json.as_bytes(), &keys, nonce))
    }

    pub fn decrypt_secret_value_v3(
        &self,
        path: impl IntoPath,
        blob: &str,
    ) -> Result<Option<Value>, KernelError> {
        let path = path.into_path().map_err(KernelError::InvalidPath)?;
        let keys = self.secret_blob_keys_v3(path, SecretMaterialMode::Value)?;
        let Some(cleartext) = decrypt_blob_v3_cleartext(blob, &keys) else {
            return Ok(None);
        };
        let Ok(json) = String::from_utf8(cleartext) else {
            return Ok(None);
        };
        Ok(json_to_value(&json))
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
            Some(Value::String(expression.to_string())),
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

        let path_for_noise = path.clone();
        let memory_index = self.memories.len();
        self.commit_memory(
            path,
            Some("~".to_string()),
            Value::String("***".to_string()),
        )?;
        self.local_noises
            .insert(path_for_noise, noise.trim().to_string());
        Ok(&self.memories[memory_index])
    }

    pub fn secret(&mut self, path: impl IntoPath, secret: &str) -> Result<&Memory, KernelError> {
        if secret.trim().is_empty() {
            return Err(KernelError::EmptySecret);
        }

        let path = path.into_path().map_err(KernelError::InvalidPath)?;
        if path.is_empty() {
            return Err(KernelError::EmptyPath);
        }

        let path_for_secret = path.clone();
        let memory_index = self.memories.len();
        self.commit_memory(
            path,
            Some("_".to_string()),
            Value::String("***".to_string()),
        )?;
        self.local_secrets
            .insert(path_for_secret, secret.trim().to_string());
        Ok(&self.memories[memory_index])
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

    pub fn read_fresh(&mut self, path: impl IntoPath) -> Option<Value> {
        let Ok(path) = path.into_path() else {
            return None;
        };
        let resolved = self
            .resolve_index_pointer_path(&path, 8)
            .unwrap_or_else(|| path.clone());
        self.ensure_target_fresh(&resolved, &mut BTreeSet::new());
        self.resolve_index_pointer_path(&path, 8)
            .and_then(|resolved| self.read_owner_path(&resolved).cloned())
    }

    pub fn read_public(&self, path: impl IntoPath) -> Option<&Value> {
        let Ok(path) = path.into_path() else {
            return None;
        };
        self.resolve_index_pointer_path(&path, 8)
            .and_then(|resolved| self.index.get(&resolved))
    }

    pub fn explain_fresh(&mut self, path: impl IntoPath) -> Result<ExplainResult, KernelError> {
        let path = path.into_path().map_err(KernelError::InvalidPath)?;
        self.read_fresh(path.clone());
        self.explain(path)
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
        let wave = self
            .last_recompute_wave_by_target
            .get(&resolution.resolved_path);
        let recomputed = wave
            .map(|wave| wave.recomputed.iter().cloned().collect::<Vec<_>>())
            .unwrap_or_default();

        Ok(ExplainResult {
            path,
            value,
            expr,
            meta: ExplainMeta {
                depends_on,
                resolved_path: resolution.resolved_path,
                pointer_chain: resolution.pointer_chain,
                secret,
                k: recomputed.len(),
                recomputed,
                source_path: wave.map(|wave| wave.source_path.clone()),
            },
            derivation,
        })
    }

    pub fn export_snapshot(&self) -> Snapshot {
        Snapshot {
            memories: self.memories.clone(),
            local_secrets: self.local_secrets.clone(),
            local_noises: self.local_noises.clone(),
            operators: self.operators.clone(),
        }
    }

    pub fn hydrate(snapshot: Snapshot) -> Result<Self, KernelError> {
        let mut kernel = Self::new();
        kernel.operators.extend(snapshot.operators.clone());
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
                memory.expression.as_ref(),
                &memory.value,
                secret_opt(&kernel.compute_effective_secret(&memory.path)),
                memory.prev_hash.as_deref(),
            );
            if expected != memory.hash {
                return Err(KernelError::HydrationHashMismatch {
                    path: memory.path,
                    expected,
                    actual: memory.hash,
                });
            }

            let operator_kind = memory
                .operator
                .as_deref()
                .and_then(|operator| kernel.operator_kind(operator));
            if operator_kind == Some("eval") {
                if let Some(expression) = expression_string_from_memory(&memory) {
                    let eval_scope = parent_path(&memory.path);
                    kernel.register_derivation(memory.path.clone(), eval_scope, expression);
                }
            }
            kernel.apply_memory(&memory)?;
            match memory.operator.as_deref() {
                Some("_") => {
                    if let Some(secret) = snapshot.local_secrets.get(&memory.path) {
                        kernel
                            .local_secrets
                            .insert(memory.path.clone(), secret.clone());
                    }
                }
                Some("~") => {
                    if let Some(noise) = snapshot.local_noises.get(&memory.path) {
                        kernel
                            .local_noises
                            .insert(memory.path.clone(), noise.clone());
                    }
                }
                _ => {}
            }
            expected_prev_hash = Some(memory.hash.clone());
            let operator_kind = memory
                .operator
                .as_deref()
                .and_then(|operator| kernel.operator_kind(operator));
            if operator_kind == Some("identity") && memory.path.is_empty() {
                if let Value::Identity(id) = &memory.value {
                    kernel.active_identity = Some(id.clone());
                }
            }
            kernel.memories.push(memory);
        }

        Ok(kernel)
    }

    pub fn learn(&mut self, memory: &Memory) -> Result<&Memory, KernelError> {
        let memory_index = self.memories.len();
        self.learn_record(memory)?;
        Ok(&self.memories[memory_index])
    }

    pub fn replay_memories<I>(&mut self, memories: I) -> Result<(), KernelError>
    where
        I: IntoIterator<Item = Memory>,
    {
        let mut replayed = Self::new();
        replayed.operators = self.operators.clone();
        replayed.recompute_mode = self.recompute_mode;

        for memory in memories {
            replayed.learn(&memory)?;
        }

        *self = replayed;
        Ok(())
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
        expression: Option<Value>,
        invalidate: bool,
    ) -> Result<&Memory, KernelError> {
        ensure_value_is_supported(&value)?;
        if let Some(expression) = &expression {
            ensure_value_is_supported(expression)?;
        }

        let prev_hash = self.memories.last().map(|memory| memory.hash.clone());
        let effective_secret = self.compute_effective_secret(&path);
        let stored_value = self.stored_value_for_memory(&path, operator.as_deref(), &value)?;
        let hash = hash_memory(
            &path,
            operator.as_deref(),
            expression.as_ref(),
            &stored_value,
            secret_opt(&effective_secret),
            prev_hash.as_deref(),
        );
        let source_path = path.clone();
        let memory_index = self.memories.len();
        let memory = Memory {
            path,
            operator,
            expression,
            value: stored_value,
            prev_hash,
            hash,
        };

        self.apply_memory(&memory)?;
        self.memories.push(memory);
        if invalidate {
            self.invalidate_from_path(&source_path);
        }
        Ok(&self.memories[memory_index])
    }

    fn apply_memory(&mut self, memory: &Memory) -> Result<(), KernelError> {
        let operator_kind = memory
            .operator
            .as_deref()
            .and_then(|operator| self.operator_kind(operator))
            .map(ToOwned::to_owned);

        match operator_kind.as_deref() {
            Some("secret") => {
                self.secret_scopes.insert(memory.path.clone());
                move_index_prefix_to_private(
                    &mut self.index,
                    &mut self.private_index,
                    &memory.path,
                );
            }
            Some("noise") => {
                self.noise_scopes.insert(memory.path.clone());
            }
            Some("remove") => {
                remove_index_prefix(&mut self.index, &memory.path);
                remove_index_prefix(&mut self.private_index, &memory.path);
                self.secret_scopes
                    .retain(|scope| !path_starts_with(scope, &memory.path));
                self.noise_scopes
                    .retain(|scope| !path_starts_with(scope, &memory.path));
                self.local_secrets
                    .retain(|scope, _| !path_starts_with(scope, &memory.path));
                self.local_noises
                    .retain(|scope, _| !path_starts_with(scope, &memory.path));
                self.clear_derivations_by_prefix(&memory.path);
            }
            Some("identity") if memory.path.is_empty() => {
                if let Value::Identity(id) = &memory.value {
                    self.active_identity = Some(id.clone());
                }
                self.index.insert(memory.path.clone(), memory.value.clone());
            }
            _ if self.is_under_secret_scope(&memory.path) => {
                self.index.remove(&memory.path);
                let value = self.value_for_private_index(memory)?;
                self.private_index.insert(memory.path.clone(), value);
            }
            _ => {
                self.index.insert(memory.path.clone(), memory.value.clone());
            }
        }
        Ok(())
    }

    fn learn_record(&mut self, memory: &Memory) -> Result<(), KernelError> {
        let operator_kind = memory
            .operator
            .as_deref()
            .and_then(|operator| self.operator_kind(operator))
            .map(ToOwned::to_owned);

        if memory.path.is_empty() && operator_kind.as_deref() != Some("identity") {
            return Err(KernelError::EmptyPath);
        }

        match operator_kind.as_deref() {
            Some("secret") => {
                let secret = secret_from_memory(memory);
                let memory_index = self.memories.len();
                self.commit_memory_with_expression(
                    memory.path.clone(),
                    memory.operator.clone(),
                    Value::String("***".to_string()),
                    memory.expression.clone(),
                    true,
                )?;
                self.local_secrets.insert(memory.path.clone(), secret);
                debug_assert_eq!(self.memories.len(), memory_index + 1);
            }
            Some("noise") => {
                let noise = secret_from_memory(memory);
                let memory_index = self.memories.len();
                self.commit_memory_with_expression(
                    memory.path.clone(),
                    memory.operator.clone(),
                    Value::String("***".to_string()),
                    memory.expression.clone(),
                    true,
                )?;
                self.local_noises.insert(memory.path.clone(), noise);
                debug_assert_eq!(self.memories.len(), memory_index + 1);
            }
            Some("identity") => {
                let id = identity_from_memory(memory)?;
                let id = normalize_identity(&id)?;
                self.commit_memory_with_expression(
                    memory.path.clone(),
                    memory.operator.clone(),
                    Value::Identity(id.clone()),
                    memory.expression.clone(),
                    true,
                )?;
                if memory.path.is_empty() {
                    self.active_identity = Some(id);
                }
            }
            Some("pointer") => {
                let target = pointer_from_memory(memory)?;
                self.commit_memory_with_expression(
                    memory.path.clone(),
                    memory.operator.clone(),
                    Value::Pointer(target),
                    memory.expression.clone(),
                    true,
                )?;
            }
            Some("remove") => {
                self.commit_memory_with_expression(
                    memory.path.clone(),
                    memory.operator.clone(),
                    Value::Null,
                    memory.expression.clone(),
                    true,
                )?;
            }
            Some("eval") => {
                if let Some(expression) = expression_string_from_memory(memory) {
                    let eval_scope = parent_path(&memory.path);
                    self.register_derivation(memory.path.clone(), eval_scope, expression);
                }
                self.commit_memory_with_expression(
                    memory.path.clone(),
                    memory.operator.clone(),
                    memory.value.clone(),
                    memory.expression.clone(),
                    true,
                )?;
            }
            _ => {
                self.commit_memory_with_expression(
                    memory.path.clone(),
                    memory.operator.clone(),
                    memory.value.clone(),
                    memory.expression.clone(),
                    true,
                )?;
            }
        }

        Ok(())
    }

    fn is_under_secret_scope(&self, path: &[String]) -> bool {
        self.secret_scopes
            .iter()
            .any(|scope| path_starts_with(path, scope))
    }

    fn stored_value_for_memory(
        &self,
        path: &[String],
        operator: Option<&str>,
        value: &Value,
    ) -> Result<Value, KernelError> {
        if !self.should_encrypt_memory_value(path, operator, value) {
            return Ok(value.clone());
        }
        let nonce = random_blob_v3_nonce().ok_or(KernelError::RandomUnavailable)?;
        let blob = self.encrypt_secret_value_v3(path.to_vec(), value.clone(), nonce)?;
        Ok(Value::String(blob))
    }

    fn should_encrypt_memory_value(
        &self,
        path: &[String],
        operator: Option<&str>,
        value: &Value,
    ) -> bool {
        operator.is_none()
            && self.is_under_secret_scope(path)
            && !matches!(value, Value::Pointer(_) | Value::Identity(_))
    }

    fn value_for_private_index(&self, memory: &Memory) -> Result<Value, KernelError> {
        if !self.should_encrypt_memory_value(
            &memory.path,
            memory.operator.as_deref(),
            &memory.value,
        ) {
            return Ok(memory.value.clone());
        }
        let Value::String(blob) = &memory.value else {
            return Err(KernelError::SecretBlobDecryptFailed(memory.path.clone()));
        };
        self.decrypt_secret_value_v3(memory.path.clone(), blob)?
            .ok_or_else(|| KernelError::SecretBlobDecryptFailed(memory.path.clone()))
    }

    fn compute_effective_secret(&self, path: &[String]) -> String {
        let active_noise = self.find_active_noise(path);
        let mut seed = String::from("root");

        if let Some((_, noise)) = &active_noise {
            seed = portable_hash_fnv1a(&format!("noise::{noise}"));
        }

        for index in 1..=path.len() {
            let secret_path = path[..index].to_vec();
            let Some(secret) = self.local_secrets.get(&secret_path) else {
                continue;
            };
            if !secret_allowed_under_noise(
                active_noise.as_ref().map(|(path, _)| path),
                &secret_path,
            ) {
                continue;
            }
            seed = portable_hash_fnv1a(&format!("{seed}::{secret}"));
        }

        if seed == "root" {
            String::new()
        } else {
            seed
        }
    }

    fn find_active_noise(&self, path: &[String]) -> Option<(Path, String)> {
        let mut active = None;
        for index in 1..=path.len() {
            let noise_path = path[..index].to_vec();
            if let Some(noise) = self.local_noises.get(&noise_path) {
                active = Some((noise_path, noise.clone()));
            }
        }
        active
    }

    fn collect_secret_chain_v3(
        &self,
        target_path: &[String],
        mode: SecretMaterialMode,
    ) -> Result<Vec<Vec<u8>>, KernelError> {
        let scope_path = self
            .resolve_branch_scope(target_path)
            .ok_or_else(|| KernelError::NoSecretContext(target_path.to_vec()))?;
        if mode == SecretMaterialMode::Branch && scope_path.is_empty() {
            return Err(KernelError::RootSecretBranchUnsupported);
        }

        let anchor_path = match mode {
            SecretMaterialMode::Branch => scope_path.clone(),
            SecretMaterialMode::Value => target_path.to_vec(),
        };
        let active_noise = self.find_active_noise(&anchor_path);
        let noise_boundary = active_noise
            .as_ref()
            .map(|(path, _)| path.join("."))
            .unwrap_or_else(|| V3_NO_NOISE_SENTINEL.to_string());

        let mut chain = vec![
            V3_DOMAIN.as_bytes().to_vec(),
            match mode {
                SecretMaterialMode::Branch => b"branch".to_vec(),
                SecretMaterialMode::Value => b"value".to_vec(),
            },
            scope_path.join(".").into_bytes(),
            anchor_path.join(".").into_bytes(),
            noise_boundary.into_bytes(),
        ];
        chain.extend(self.collect_lineage_segments(&anchor_path, active_noise.as_ref()));
        Ok(chain)
    }

    fn resolve_branch_scope(&self, path: &[String]) -> Option<Path> {
        let mut best = self.local_secrets.get(&Vec::new()).map(|_| Vec::new());
        for index in 1..=path.len() {
            let scope_path = path[..index].to_vec();
            if self.local_secrets.contains_key(&scope_path) {
                best = Some(scope_path);
            }
        }
        best
    }

    fn collect_lineage_segments(
        &self,
        anchor_path: &[String],
        active_noise: Option<&(Path, String)>,
    ) -> Vec<Vec<u8>> {
        let mut out = Vec::new();

        if let Some((path, noise)) = active_noise {
            out.push(lineage_segment("noise", &path.join("."), noise));
        } else if let Some(root_secret) = self.local_secrets.get(&Vec::new()) {
            out.push(lineage_segment("secret", "", root_secret));
        }

        for index in 1..=anchor_path.len() {
            let secret_path = anchor_path[..index].to_vec();
            let Some(secret) = self.local_secrets.get(&secret_path) else {
                continue;
            };
            if !secret_allowed_under_noise(active_noise.map(|(path, _)| path), &secret_path) {
                continue;
            }
            out.push(lineage_segment("secret", &secret_path.join("."), secret));
        }

        out
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
        self.last_recompute_wave_by_target.remove(target_path);
        self.stale_derivations.remove(target_path);

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
        let started_wave = self.begin_recompute_wave(source_path);
        if self.recompute_mode == RecomputeMode::Lazy {
            self.mark_stale_from_path(source_path);
            if started_wave {
                self.finalize_recompute_wave();
            }
            return;
        }

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

        if started_wave {
            self.finalize_recompute_wave();
        }
    }

    fn mark_stale_from_path(&mut self, source_path: &[String]) {
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
                self.stale_derivations.insert(target_path.clone());
                queue.push_back(target_path);
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

        let recomputed = self
            .commit_memory_with_expression(
                target_path.to_vec(),
                Some("=".to_string()),
                value,
                Some(Value::String(record.expression)),
                false,
            )
            .is_ok();

        if recomputed {
            self.record_recomputed_target(target_path);
            self.stale_derivations.remove(target_path);
        }

        recomputed
    }

    fn ensure_target_fresh(
        &mut self,
        target_path: &[String],
        visiting: &mut BTreeSet<Path>,
    ) -> bool {
        if self.recompute_mode != RecomputeMode::Lazy {
            return false;
        }
        if !self.derivations.contains_key(target_path) {
            return false;
        }
        if !visiting.insert(target_path.to_vec()) {
            return false;
        }

        let started_wave = self.begin_recompute_wave(target_path);
        let refs = self
            .derivations
            .get(target_path)
            .map(|record| record.refs.clone())
            .unwrap_or_default();

        for reference in refs {
            if self.derivations.contains_key(&reference.path) {
                self.ensure_target_fresh(&reference.path, visiting);
            }
        }

        let changed = if self.stale_derivations.contains(target_path) {
            self.recompute_target(target_path)
        } else {
            false
        };

        visiting.remove(target_path);
        if started_wave {
            self.finalize_recompute_wave();
        }
        changed
    }

    fn begin_recompute_wave(&mut self, source_path: &[String]) -> bool {
        if self.active_recompute_wave.is_some() {
            return false;
        }
        self.active_recompute_wave = Some(RecomputeWave {
            source_path: source_path.to_vec(),
            recomputed: BTreeSet::new(),
        });
        true
    }

    fn record_recomputed_target(&mut self, target_path: &[String]) {
        let Some(wave) = &mut self.active_recompute_wave else {
            return;
        };
        wave.recomputed.insert(target_path.to_vec());
    }

    fn finalize_recompute_wave(&mut self) {
        let Some(wave) = self.active_recompute_wave.take() else {
            return;
        };
        if wave.recomputed.is_empty() {
            return;
        }
        for target_path in &wave.recomputed {
            self.last_recompute_wave_by_target
                .insert(target_path.clone(), wave.clone());
        }
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

    fn inspect_memories<'a>(&self, memories: impl Iterator<Item = &'a Memory>) -> InspectResult {
        InspectResult {
            memories: memories
                .map(|memory| InspectMemory {
                    path: memory.path.clone(),
                    operator: memory.operator.clone(),
                    expression: if self.is_under_secret_scope(&memory.path) {
                        None
                    } else {
                        memory.expression.clone()
                    },
                    value: if self.is_under_secret_scope(&memory.path) {
                        Value::String("****".to_string())
                    } else {
                        memory.value.clone()
                    },
                    prev_hash: memory.prev_hash.clone(),
                    hash: memory.hash.clone(),
                })
                .collect(),
            index: self.index.clone(),
            secret_scopes: self.secret_scopes.iter().cloned().collect(),
            noise_scopes: self.noise_scopes.iter().cloned().collect(),
            derivations: self.derivations.keys().cloned().collect(),
        }
    }
}

fn remove_index_prefix(index: &mut BTreeMap<Path, Value>, prefix: &[String]) {
    index.retain(|path, _| !path_starts_with(path, prefix));
}

fn default_operators() -> BTreeMap<String, OperatorDefinition> {
    [
        ("_", "secret"),
        ("~", "noise"),
        ("__", "pointer"),
        ("->", "pointer"),
        ("@", "identity"),
        ("=", "eval"),
        ("?", "query"),
        ("-", "remove"),
    ]
    .into_iter()
    .map(|(operator, kind)| {
        (
            operator.to_string(),
            OperatorDefinition {
                kind: kind.to_string(),
            },
        )
    })
    .collect()
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

fn secret_from_memory(memory: &Memory) -> String {
    memory
        .expression
        .as_ref()
        .and_then(string_from_value)
        .filter(|value| !value.is_empty())
        .map(|value| value.trim().to_string())
        .or_else(|| match &memory.value {
            Value::String(value) => {
                let value = value.trim();
                (!value.is_empty() && value != "***" && value != "****").then(|| value.to_string())
            }
            _ => None,
        })
        .unwrap_or_else(|| "***".to_string())
}

fn identity_from_memory(memory: &Memory) -> Result<String, KernelError> {
    identity_from_value(&memory.value)
        .or_else(|| memory.expression.as_ref().and_then(identity_from_value))
        .ok_or_else(|| KernelError::InvalidIdentity(String::new()))
}

fn identity_from_value(value: &Value) -> Option<String> {
    match value {
        Value::Identity(id) | Value::String(id) => Some(id.clone()),
        Value::Object(values) => values.get("__id").and_then(identity_from_value),
        _ => None,
    }
}

fn pointer_from_memory(memory: &Memory) -> Result<Path, KernelError> {
    pointer_from_value(&memory.value)
        .or_else(|| memory.expression.as_ref().and_then(pointer_from_value))
        .filter(|path| !path.is_empty())
        .ok_or(KernelError::EmptyPath)
}

fn pointer_from_value(value: &Value) -> Option<Path> {
    match value {
        Value::Pointer(path) => Some(path.clone()),
        Value::String(path) => path.as_str().into_path().ok(),
        Value::Object(values) => values.get("__ptr").and_then(pointer_from_value),
        _ => None,
    }
}

fn expression_string_from_memory(memory: &Memory) -> Option<String> {
    memory.expression.as_ref().and_then(string_from_value)
}

fn string_from_value(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.trim().to_string()),
        _ => None,
    }
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
    expression: Option<&Value>,
    value: &Value,
    effective_secret: Option<&str>,
    prev_hash: Option<&str>,
) -> String {
    let mut input = String::new();
    input.push_str("{\"path\":");
    push_json_string(&mut input, &path.join("."));
    input.push_str(",\"operator\":");
    push_json_optional_string(&mut input, operator);
    input.push_str(",\"expression\":");
    push_json_optional_value(&mut input, expression);
    input.push_str(",\"value\":");
    push_json_value(&mut input, value);
    input.push_str(",\"effectiveSecret\":");
    push_json_optional_string(&mut input, effective_secret);
    input.push_str(",\"prevHash\":");
    push_json_string(&mut input, prev_hash.unwrap_or(""));
    input.push('}');

    portable_hash_fnv1a(&input)
}

fn secret_opt(value: &str) -> Option<&str> {
    (!value.is_empty()).then_some(value)
}

fn secret_allowed_under_noise(noise_path: Option<&Path>, secret_path: &[String]) -> bool {
    let Some(noise_path) = noise_path else {
        return true;
    };
    path_starts_with(secret_path, noise_path)
}

fn portable_hash_fnv1a(input: &str) -> String {
    let mut hash = 0x811c_9dc5_u32;
    for unit in input.encode_utf16() {
        hash ^= u32::from(unit);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    format!("{hash:08x}")
}

fn push_json_optional_string(out: &mut String, value: Option<&str>) {
    match value {
        Some(value) => push_json_string(out, value),
        None => out.push_str("null"),
    }
}

fn push_json_optional_value(out: &mut String, value: Option<&Value>) {
    match value {
        Some(value) => push_json_value(out, value),
        None => out.push_str("null"),
    }
}

fn push_json_string(out: &mut String, value: &str) {
    out.push('"');
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            ch if ch <= '\u{1f}' => {
                out.push_str("\\u00");
                push_hex_nibble(out, (ch as u32 >> 4) & 0x0f);
                push_hex_nibble(out, ch as u32 & 0x0f);
            }
            ch => out.push(ch),
        }
    }
    out.push('"');
}

fn push_hex_nibble(out: &mut String, value: u32) {
    let ch = match value {
        0..=9 => char::from(b'0' + value as u8),
        10..=15 => char::from(b'a' + (value as u8 - 10)),
        _ => unreachable!("hex nibble must be <= 15"),
    };
    out.push(ch);
}

fn push_json_value(out: &mut String, value: &Value) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(value) => out.push_str(if *value { "true" } else { "false" }),
        Value::Number(value) => {
            if value.to_bits() == (-0.0_f64).to_bits() {
                out.push('0');
            } else {
                out.push_str(&value.to_string());
            }
        }
        Value::String(value) => push_json_string(out, value),
        Value::Array(values) => {
            out.push('[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                push_json_value(out, value);
            }
            out.push(']');
        }
        Value::Object(values) => {
            out.push('{');
            for (index, (key, value)) in values.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                push_json_string(out, key);
                out.push(':');
                push_json_value(out, value);
            }
            out.push('}');
        }
        Value::Pointer(path) => {
            out.push_str("{\"__ptr\":");
            push_json_string(out, &path.join("."));
            out.push('}');
        }
        Value::Identity(id) => {
            out.push_str("{\"__id\":");
            push_json_string(out, id);
            out.push('}');
        }
    }
}

fn json_to_value(input: &str) -> Option<Value> {
    let value = serde_json::from_str::<serde_json::Value>(input).ok()?;
    serde_json_to_value(value)
}

fn serde_json_to_value(value: serde_json::Value) -> Option<Value> {
    match value {
        serde_json::Value::Null => Some(Value::Null),
        serde_json::Value::Bool(value) => Some(Value::Bool(value)),
        serde_json::Value::Number(value) => value.as_f64().map(Value::Number),
        serde_json::Value::String(value) => Some(Value::String(value)),
        serde_json::Value::Array(values) => values
            .into_iter()
            .map(serde_json_to_value)
            .collect::<Option<Vec<_>>>()
            .map(Value::Array),
        serde_json::Value::Object(values) => values
            .into_iter()
            .map(|(key, value)| serde_json_to_value(value).map(|value| (key, value)))
            .collect::<Option<BTreeMap<_, _>>>()
            .map(Value::Object),
    }
}
