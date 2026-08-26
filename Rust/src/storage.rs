use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value as JsonValue;

use crate::kernel::{snapshot_from_json, snapshot_to_json, Kernel, KernelError, Snapshot};

#[derive(Debug)]
pub enum StorageError {
    Io(std::io::Error),
    Json(serde_json::Error),
    Codec(crate::kernel::JsonCodecError),
    Kernel(KernelError),
}

impl fmt::Display for StorageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(error) => write!(f, "{error}"),
            Self::Json(error) => write!(f, "{error}"),
            Self::Codec(error) => write!(f, "{error}"),
            Self::Kernel(error) => write!(f, "{error}"),
        }
    }
}

impl std::error::Error for StorageError {}

impl From<std::io::Error> for StorageError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<serde_json::Error> for StorageError {
    fn from(error: serde_json::Error) -> Self {
        Self::Json(error)
    }
}

impl From<crate::kernel::JsonCodecError> for StorageError {
    fn from(error: crate::kernel::JsonCodecError) -> Self {
        Self::Codec(error)
    }
}

impl From<KernelError> for StorageError {
    fn from(error: KernelError) -> Self {
        Self::Kernel(error)
    }
}

pub trait MemoryStore {
    fn load_snapshot(&self) -> Result<Option<Snapshot>, StorageError>;
    fn save_snapshot(&self, snapshot: &Snapshot) -> Result<(), StorageError>;

    fn load_kernel(&self) -> Result<Kernel, StorageError> {
        match self.load_snapshot()? {
            Some(snapshot) => Ok(Kernel::hydrate(snapshot)?),
            None => Ok(Kernel::new()),
        }
    }

    fn save_kernel(&self, kernel: &Kernel) -> Result<(), StorageError> {
        self.save_snapshot(&kernel.export_snapshot())
    }
}

#[derive(Debug, Clone)]
pub struct JsonFileStore {
    path: PathBuf,
}

impl JsonFileStore {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl MemoryStore for JsonFileStore {
    fn load_snapshot(&self) -> Result<Option<Snapshot>, StorageError> {
        if !self.path.exists() {
            return Ok(None);
        }

        let raw = fs::read_to_string(&self.path)?;
        if raw.trim().is_empty() {
            return Ok(None);
        }

        let json = serde_json::from_str::<JsonValue>(&raw)?;
        Ok(Some(snapshot_from_json(&json)?))
    }

    fn save_snapshot(&self, snapshot: &Snapshot) -> Result<(), StorageError> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }

        let json = snapshot_to_json(snapshot);
        let raw = serde_json::to_string_pretty(&json)?;
        let tmp_path = self.path.with_extension(format!(
            "{}tmp",
            self.path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| format!("{extension}."))
                .unwrap_or_default()
        ));

        fs::write(&tmp_path, raw)?;
        fs::rename(&tmp_path, &self.path)?;
        Ok(())
    }
}
