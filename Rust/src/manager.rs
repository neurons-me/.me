//this.me/crate/src/manager.rs
//by suiGn.
use std::fs;
use std::path::PathBuf;
use crate::utils::me_error::MeError;
#[cfg(feature = "sqlite")]
use rusqlite;
#[derive(Debug)]
pub struct MeSummary {
    pub username: String,
    pub path: PathBuf,
}

/// Loads public data (e.g., username and public_key) for an identity
#[cfg(feature = "sqlite")]
pub fn load_public(username: &str) -> Result<(String, String), MeError> {
    let home = dirs::home_dir().ok_or_else(|| MeError::Validation("No HOME dir".to_string()))?;
    let db_path = home.join(".this").join("me").join(username).join(format!("{}.db", username));
    if !db_path.exists() {
        return Err(MeError::Validation("Identity does not exist.".to_string()));
    }

    let conn = rusqlite::Connection::open(&db_path).map_err(MeError::Database)?;
    let mut stmt = conn.prepare("SELECT public_key FROM identity_keys LIMIT 1")
        .map_err(MeError::Database)?;
    let mut rows = stmt.query([]).map_err(MeError::Database)?;
    if let Some(row) = rows.next().map_err(MeError::Database)? {
        let public_key: String = row.get(0).map_err(MeError::Database)?;
        Ok((username.to_string(), public_key))
    } else {
        Err(MeError::Validation("Public key not found.".to_string()))
    }
}

pub fn list_us() -> Result<Vec<MeSummary>, MeError> {
    let home = dirs::home_dir().ok_or_else(|| MeError::Validation("No HOME dir".to_string()))?;
    let base_path = home.join(".this").join("me");
    let mut list = vec![];
    if let Ok(entries) = fs::read_dir(base_path) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(username) = entry.file_name().to_str() {
                    list.push(MeSummary {
                        username: username.to_string(),
                        path: entry.path(),
                    });
                }
            }
        }
    }

    Ok(list)
}