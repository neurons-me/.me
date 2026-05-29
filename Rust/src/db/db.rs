//this.me/crate/src/db/db.rs
// by suiGn
// This file contains the database connection and migration logic for the "this.me" crate.
// It establishes a connection to the SQLite database and runs the migration script if specified.
// The migration script creates necessary tables for the verbs used in the application.
// It uses the rusqlite library for SQLite database operations.
use std::path::PathBuf;
use dirs::home_dir;
use rusqlite::{Connection, Result};
use crate::db::migrate_schema;

pub fn connect(alias: &str, with_migration: bool) -> Result<(Connection, bool)> {
    let home = home_dir().ok_or_else(|| {
        rusqlite::Error::InvalidPath("HOME directory not found".into())
    })?;

    let db_path: PathBuf = home.join(".this").join("me").join(alias).join(format!("{}.db", alias));
    let existed = db_path.exists();
    std::fs::create_dir_all(db_path.parent().unwrap())
        .map_err(|e| rusqlite::Error::InvalidPath(PathBuf::from(format!("Failed to create dir: {}", e))))?;
    let conn = Connection::open(&db_path)?;

    if with_migration && !existed {
        migrate_schema::migrate_schema(&conn)?;
    }

    Ok((conn, existed))
}