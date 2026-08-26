use std::fmt;

use crate::kernel::{
    ExecuteError, ExecuteValue, IntoPath, Kernel, KernelError, KernelEvent, Memory, Value,
};
use crate::storage::{MemoryStore, StorageError};

#[derive(Debug)]
pub enum RuntimeError {
    Kernel(KernelError),
    Execute(ExecuteError),
    Storage(StorageError),
}

impl fmt::Display for RuntimeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Kernel(error) => write!(f, "{error}"),
            Self::Execute(error) => write!(f, "{error}"),
            Self::Storage(error) => write!(f, "{error}"),
        }
    }
}

impl std::error::Error for RuntimeError {}

impl From<KernelError> for RuntimeError {
    fn from(error: KernelError) -> Self {
        Self::Kernel(error)
    }
}

impl From<ExecuteError> for RuntimeError {
    fn from(error: ExecuteError) -> Self {
        Self::Execute(error)
    }
}

impl From<StorageError> for RuntimeError {
    fn from(error: StorageError) -> Self {
        Self::Storage(error)
    }
}

#[derive(Debug)]
pub struct KernelRuntime<S> {
    kernel: Kernel,
    store: S,
}

impl<S> KernelRuntime<S>
where
    S: MemoryStore,
{
    pub fn load(store: S) -> Result<Self, RuntimeError> {
        let kernel = store.load_kernel()?;
        Ok(Self { kernel, store })
    }

    pub fn new(kernel: Kernel, store: S) -> Self {
        Self { kernel, store }
    }

    pub fn kernel(&self) -> &Kernel {
        &self.kernel
    }

    pub fn store(&self) -> &S {
        &self.store
    }

    pub fn save(&self) -> Result<(), RuntimeError> {
        Ok(self.store.save_kernel(&self.kernel)?)
    }

    pub fn read(&self, path: impl IntoPath) -> Option<&Value> {
        self.kernel.read(path)
    }

    pub fn read_fresh(&mut self, path: impl IntoPath) -> Option<Value> {
        self.kernel.read_fresh(path)
    }

    pub fn write(
        &mut self,
        path: impl IntoPath,
        value: impl Into<Value>,
    ) -> Result<Memory, RuntimeError> {
        let memory = self.kernel.postulate(path, value)?.clone();
        self.save()?;
        Ok(memory)
    }

    pub fn execute(
        &mut self,
        target: impl AsRef<str>,
        body: Option<ExecuteValue>,
    ) -> Result<ExecuteValue, RuntimeError> {
        let result = self.kernel.execute(target, body)?;
        self.save()?;
        Ok(result)
    }

    pub fn events(&self) -> &[KernelEvent] {
        self.kernel.events()
    }

    pub fn events_matching(&self, path: impl IntoPath) -> Result<Vec<KernelEvent>, RuntimeError> {
        Ok(self.kernel.events_matching(path)?)
    }

    pub fn drain_events(&mut self) -> Vec<KernelEvent> {
        self.kernel.drain_events()
    }

    pub fn drain_events_matching(
        &mut self,
        path: impl IntoPath,
    ) -> Result<Vec<KernelEvent>, RuntimeError> {
        Ok(self.kernel.drain_events_matching(path)?)
    }
}
