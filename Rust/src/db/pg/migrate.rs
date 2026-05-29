// this.me/crate/src/db/pg/migrate.rs
// Postgres migrations mirroring the existing SQLite schema exactly.
// We keep table names and columns identical to SQLite (types as TEXT),
// to ensure the .me protocol is consistent across backends.
use sqlx::Pool;
use sqlx::postgres::Postgres;
/// Run PostgreSQL migrations for the `this.me` schema.
/// NOTE: This mirrors the SQLite schema 1:1 (no extra schema prefix, same table names/columns).
pub async fn run_migrations(pool: &Pool<Postgres>) -> Result<(), sqlx::Error> {
    // 0) Schema
    sqlx::query(r#"CREATE SCHEMA IF NOT EXISTS me"#).execute(pool).await?;
    // 1) Identidad global (igual que en SQLite: username, public_key, encrypted_private_key, created_at)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS me.me (
            username TEXT PRIMARY KEY,
            public_key TEXT NOT NULL,
            encrypted_private_key TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 2) Keys/secretos
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS me.keys (
            context_id TEXT PRIMARY KEY,
            username TEXT,
            type TEXT DEFAULT 'generic',
            public_address TEXT,
            created_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 3) Verbos (timestamps como TEXT para espejo 1:1 con SQLite)
    for ddl in [
        r#"CREATE TABLE IF NOT EXISTS me.be (context_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, timestamp TEXT NOT NULL)"#,
        r#"CREATE TABLE IF NOT EXISTS me.do_ (context_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, timestamp TEXT NOT NULL)"#,
        r#"CREATE TABLE IF NOT EXISTS me.have (context_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, timestamp TEXT NOT NULL)"#,
        r#"CREATE TABLE IF NOT EXISTS me.at (context_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, timestamp TEXT NOT NULL)"#,
        r#"CREATE TABLE IF NOT EXISTS me.relate (context_id TEXT NOT NULL, key TEXT NOT NULL, target TEXT NOT NULL, value TEXT, timestamp TEXT NOT NULL)"#,
        r#"CREATE TABLE IF NOT EXISTS me.react (context_id TEXT NOT NULL, key TEXT NOT NULL, target TEXT NOT NULL, emoji TEXT NOT NULL, timestamp TEXT NOT NULL)"#,
        r#"CREATE TABLE IF NOT EXISTS me.communicate (context_id TEXT NOT NULL, key TEXT NOT NULL, target TEXT NOT NULL, message TEXT NOT NULL, lang TEXT DEFAULT 'en', timestamp TEXT NOT NULL)"#,
    ] {
        sqlx::query(ddl).execute(pool).await?;
    }

    Ok(())
}