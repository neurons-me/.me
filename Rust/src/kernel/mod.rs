use std::collections::hash_map::DefaultHasher;
use std::collections::BTreeMap;
use std::fmt;
use std::hash::{Hash, Hasher};

pub type Path = Vec<String>;

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Value>),
    Object(BTreeMap<String, Value>),
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
    pub value: Value,
    pub prev_hash: Option<String>,
    pub hash: String,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Snapshot {
    pub memories: Vec<Memory>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KernelError {
    EmptyPath,
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
}

impl Kernel {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn memories(&self) -> &[Memory] {
        &self.memories
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
        let path = path.into_path();
        if path.is_empty() {
            return Err(KernelError::EmptyPath);
        }

        let value = value.into();
        ensure_value_is_supported(&value)?;

        let prev_hash = self.memories.last().map(|memory| memory.hash.clone());
        let hash = hash_memory(&path, operator.as_deref(), &value, prev_hash.as_deref());
        let memory = Memory {
            path: path.clone(),
            operator,
            value: value.clone(),
            prev_hash,
            hash,
        };

        self.index.insert(path, value);
        self.memories.push(memory);
        Ok(self
            .memories
            .last()
            .expect("memory was just pushed into the log"))
    }

    pub fn read(&self, path: impl IntoPath) -> Option<&Value> {
        self.index.get(&path.into_path())
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

            kernel
                .index
                .insert(memory.path.clone(), memory.value.clone());
            expected_prev_hash = Some(memory.hash.clone());
            kernel.memories.push(memory);
        }

        Ok(kernel)
    }
}

pub trait IntoPath {
    fn into_path(self) -> Path;
}

impl IntoPath for Path {
    fn into_path(self) -> Path {
        self
    }
}

impl IntoPath for &[&str] {
    fn into_path(self) -> Path {
        self.iter().map(|segment| (*segment).to_string()).collect()
    }
}

impl<const N: usize> IntoPath for [&str; N] {
    fn into_path(self) -> Path {
        self.into_iter().map(str::to_string).collect()
    }
}

impl IntoPath for &str {
    fn into_path(self) -> Path {
        self.split('.')
            .filter(|segment| !segment.is_empty())
            .map(str::to_string)
            .collect()
    }
}

impl IntoPath for String {
    fn into_path(self) -> Path {
        self.as_str().into_path()
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
        _ => Ok(()),
    }
}

fn hash_memory(
    path: &[String],
    operator: Option<&str>,
    value: &Value,
    prev_hash: Option<&str>,
) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    operator.hash(&mut hasher);
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
    }
}
