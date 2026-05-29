//this.me/crate/src/core/store.rs
use async_trait::async_trait;
use super::model::{Entry, GetFilter};
#[async_trait]
pub trait MeStore: Send + Sync {
    // identity
    async fn create_identity(&self, username: &str, public_key: &str, encrypted_private_key: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    async fn load_keys(&self, username: &str) -> Result<(String /*public*/, String /*encrypted_priv*/ ), Box<dyn std::error::Error + Send + Sync>>;
    async fn update_encrypted_private(&self, username: &str, encrypted: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    // verbs
    async fn insert(&self, verb: &str, context_id: &str, key: &str, value: &str, timestamp: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    async fn get(&self, filter: &GetFilter) -> Result<Vec<Entry>, Box<dyn std::error::Error + Send + Sync>>;
}