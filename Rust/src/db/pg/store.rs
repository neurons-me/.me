use async_trait::async_trait;
use sqlx::{Pool, Postgres, Row, QueryBuilder};
use crate::core::store::MeStore;
use crate::core::model::{Entry, GetFilter};

#[derive(Clone)]
pub struct PgStore {
    pub pool: Pool<Postgres>,
}

impl PgStore {
    pub fn new(pool: Pool<Postgres>) -> Self { Self { pool } }

    fn table_for_verb(verb: &str) -> Option<&'static str> {
        match verb {
            "be" => Some("be"),
            "have" => Some("have"),
            "at" => Some("at"),
            "relate" => Some("relate"),
            "react" => Some("react"),
            "communicate" => Some("communicate"),
            "do" | "do_" => Some("do_"),
            "all" => None,
            _ => None,
        }
    }
    fn all_tables() -> [&'static str; 7] {
        ["be","have","at","relate","react","communicate","do_"]
    }
}

#[async_trait]
impl MeStore for PgStore {
    async fn create_identity(
        &self,
        username: &str,
        public_key: &str,
        encrypted_private_key: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // igual que SQLite pero en schema me: tabla me.me
        sqlx::query(
            r#"
            INSERT INTO me.me (username, public_key, encrypted_private_key, created_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) DO NOTHING
            "#,
        )
        .bind(username)
        .bind(public_key)
        .bind(encrypted_private_key)
        .bind(chrono::Utc::now().to_rfc3339())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn load_keys(
        &self,
        username: &str,
    ) -> Result<(String, String), Box<dyn std::error::Error + Send + Sync>> {
        // lee de me.me (no me.identity)
        let row = sqlx::query(
            r#"SELECT public_key, encrypted_private_key FROM me.me WHERE username = $1"#,
        )
        .bind(username)
        .fetch_one(&self.pool)
        .await?;

        let public_key: String = row.get("public_key");
        let enc_priv: String = row.get("encrypted_private_key");
        Ok((public_key, enc_priv))
    }

    async fn update_encrypted_private(
        &self,
        username: &str,
        encrypted: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // actualiza me.me
        sqlx::query(
            r#"UPDATE me.me SET encrypted_private_key = $1 WHERE username = $2"#,
        )
        .bind(encrypted)
        .bind(username)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn insert(
        &self,
        verb: &str,
        context_id: &str,
        key: &str,
        value: &str,
        timestamp: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let table = Self::table_for_verb(verb)
            .ok_or_else(|| format!("Unsupported verb for insert: {}", verb))?;

        match table {
            // mirror SQLite schema
            "react" => {
                // INSERT INTO react(context_id, key, target, emoji, timestamp)
                sqlx::query(
                    r#"INSERT INTO me.react (context_id, key, target, emoji, timestamp)
                       VALUES ($1,$2,$3,$4,$5)"#,
                )
                .bind(context_id)
                .bind("")            // key empty (as in SQLite)
                .bind(key)           // target = provided "key"
                .bind(value)         // emoji = provided "value"
                .bind(timestamp)
                .execute(&self.pool)
                .await?;
            }
            "communicate" => {
                // INSERT INTO communicate(context_id, key, target, message, timestamp)
                sqlx::query(
                    r#"INSERT INTO me.communicate (context_id, key, target, message, timestamp)
                       VALUES ($1,$2,$3,$4,$5)"#,
                )
                .bind(context_id)
                .bind(key)           // key
                .bind(key)           // target = key (as in SQLite)
                .bind(value)         // message
                .bind(timestamp)
                .execute(&self.pool)
                .await?;
            }
            "relate" => {
                // INSERT INTO relate(context_id, key, target, value, timestamp)
                sqlx::query(
                    r#"INSERT INTO me.relate (context_id, key, target, value, timestamp)
                       VALUES ($1,$2,$3,$4,$5)"#,
                )
                .bind(context_id)
                .bind(key)           // key
                .bind("")            // target empty (as in SQLite)
                .bind(value)         // value
                .bind(timestamp)
                .execute(&self.pool)
                .await?;
            }
            // default generic schema: (context_id, key, value, timestamp)
            _ => {
                let sql = format!(
                    "INSERT INTO me.{table} (context_id, key, value, timestamp)
                     VALUES ($1,$2,$3,$4)"
                );
                sqlx::query(&sql)
                    .bind(context_id)
                    .bind(key)
                    .bind(value)
                    .bind(timestamp)
                    .execute(&self.pool)
                    .await?;
            }
        }

        Ok(())
    }

    async fn get(
        &self,
        filter: &GetFilter,
    ) -> Result<Vec<Entry>, Box<dyn std::error::Error + Send + Sync>> {
        let tables: Vec<&str> = if filter.verb == "all" {
            Self::all_tables().to_vec()
        } else {
            vec![Self::table_for_verb(&filter.verb)
                .ok_or_else(|| format!("Unsupported verb for get(): {}", filter.verb))?]
        };

        let mut out: Vec<Entry> = Vec::new();

        for table in tables {
            // Build base SELECT depending on table schema
            let base_sql = match table {
                "react" => "SELECT target AS key, emoji AS value, timestamp AS ts FROM me.react WHERE 1=1",
                "communicate" => "SELECT target AS key, message AS value, timestamp AS ts FROM me.communicate WHERE 1=1",
                _ => {
                    // be, have, at, relate, do_
                    &*format!("SELECT key, value, timestamp AS ts FROM me.{table} WHERE 1=1")
                }
            };

            let mut qb = QueryBuilder::new(base_sql.to_string());
            if let Some(cid) = &filter.context_id { qb.push(" AND context_id = ").push_bind(cid); }
            if let Some(k) = &filter.key { qb.push(" AND key = ").push_bind(k); }
            if let Some(vv) = &filter.value { qb.push(" AND value = ").push_bind(vv); }
            if let Some(since) = &filter.since { qb.push(" AND timestamp >= ").push_bind(since); }
            if let Some(until) = &filter.until { qb.push(" AND timestamp <= ").push_bind(until); }

            qb.push(" ORDER BY timestamp DESC ");
            if let Some(lim) = &filter.limit { qb.push(" LIMIT ").push_bind(*lim as i64); } else { qb.push(" LIMIT 100 "); }
            if let Some(off) = &filter.offset { qb.push(" OFFSET ").push_bind(*off as i64); }

            let rows = qb.build().fetch_all(&self.pool).await?;
            for row in rows {
                let key: String = row.get("key");
                let value: String = row.get("value");
                let ts: String = row.get("ts");
                out.push(Entry { verb: table.to_string(), key, value, timestamp: ts });
            }
        }
        Ok(out)
    }
}