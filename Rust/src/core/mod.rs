// Storage-agnostic core API for this.me
// Exposes a generic Me<S: MeStore> over pluggable backends (Postgres, etc.)
pub mod model;
pub mod store;
pub mod me;
// Re-exports for ergonomic access from crate users:
// use this_me::core::{Me, MeStore, Entry, GetFilter};
pub use model::{Entry, GetFilter};
pub use store::MeStore;
pub use me::Me;
