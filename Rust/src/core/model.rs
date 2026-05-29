//this.me/crate/src/core/model.rs
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry { pub verb: String, pub key: String, pub value: String, pub timestamp: String }

#[derive(Debug, Clone)]
pub struct GetFilter {
    pub verb: String,
    pub key: Option<String>,
    pub value: Option<String>,
    pub context_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub since: Option<String>,
    pub until: Option<String>,
}