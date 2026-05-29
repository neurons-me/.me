//this.me/src/migrate_schema.rs
// by suiGn 
use rusqlite::{Connection, Result as SqlResult};
pub fn migrate_schema(conn: &Connection) -> SqlResult<()> {
    // Table for identity metadata (keys encrypted locally)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS me (
            username TEXT PRIMARY KEY,
            public_key TEXT NOT NULL,
            encrypted_private_key TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
        [],
    )?;
    // Table for registered keys (secrets)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS keys (
            context_id TEXT PRIMARY KEY,
            username TEXT,
            type TEXT DEFAULT 'generic',
            public_address TEXT,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    // Table for "be" verb
    conn.execute(
        "CREATE TABLE IF NOT EXISTS be (
            context_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )",
        [],
    )?;

    // Table for "have" verb
    conn.execute(
        "CREATE TABLE IF NOT EXISTS have (
            context_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )",
        [],
    )?;

    // Table for "at" verb
    conn.execute(
        "CREATE TABLE IF NOT EXISTS at (
            context_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )",
        [],
    )?;

    // Table for "relate" verb
    conn.execute(
        "CREATE TABLE IF NOT EXISTS relate (
            context_id TEXT NOT NULL,
            key TEXT NOT NULL,
            target TEXT NOT NULL,
            value TEXT,
            timestamp TEXT NOT NULL
        )",
        [],
    )?;

    // Table for "react" verb
    conn.execute(
        "CREATE TABLE IF NOT EXISTS react (
            context_id TEXT NOT NULL,
            key TEXT NOT NULL,
            target TEXT NOT NULL,
            emoji TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )",
        [],
    )?;

    // Table for "arc" (Affinity–Reality–Communication)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS arc (
            context_id TEXT NOT NULL,
            actor TEXT NOT NULL,
            target TEXT NOT NULL,
            affinity REAL DEFAULT 0.0,
            reality REAL DEFAULT 0.0,
            communication REAL DEFAULT 0.0,
            timestamp TEXT NOT NULL
        )",
        [],
    )?;

    // Table for "do" verb
    conn.execute(
        "CREATE TABLE IF NOT EXISTS do_ (
            context_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )",
        [],
    )?;

    // Table for "communicate" verb
    conn.execute(
        "CREATE TABLE IF NOT EXISTS communicate (
            context_id TEXT NOT NULL,
            key TEXT NOT NULL,
            target TEXT NOT NULL,
            message TEXT NOT NULL,
            lang TEXT DEFAULT 'en',
            timestamp TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}