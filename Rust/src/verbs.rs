//this.me/crate/src/verbs.rs
//by suiGn
/* be() - Ser algo
have() - Tener algo
at() - Estar en algún lugar
relate() - Relacionarse con algo
react() - Reaccionar a algo
say() - Decir algo */
// Los verbos se almacenan en tablas separadas y están ligados a un `context_id`.
// Un `context_id` es un hash derivado de combinaciones como:
// - me1
// - me1 + me2
// - me1 + me2 + secret
// - wikipedia.org/page + cleaker:public
//
// Esto permite registrar acciones (ser, tener, reaccionar, decir, etc.)
// dentro de espacios semánticos compartidos o privados, sin depender de usernames explícitos.
//
// Los usernames/alias (wallets, etc.) son otra capa que puede firmar, pero no son necesarios para registrar o consultar verbos por default.
use chrono::Utc;
use serde::{Deserialize, Serialize};
use rusqlite::{Connection, params};
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Action {
    pub key: String,
    pub value: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Verbs;

impl Verbs {
    pub fn new() -> Self {
        Verbs
    }

    fn now_timestamp() -> String {
        Utc::now().to_rfc3339()
    }
/*▗▄▄▖ ▗▄▄▄▖
  ▐▌ ▐▌▐▌   
  ▐▛▀▚▖▐▛▀▀▘
  ▐▙▄▞▘▐▙▄▄▖*/
    /// Registra que algo "es" en un contexto específico.
    /// El `context_id` define el espacio (privado, público, derivado, etc.) en el que se guarda el verbo.
    pub fn be(&self, conn: &Connection, context_id: &str, key: &str, value: &str) -> std::io::Result<()> {
        let timestamp = Self::now_timestamp();
        conn.execute(
            "INSERT INTO be (context_id, key, value, timestamp) VALUES (?1, ?2, ?3, ?4)",
            params![context_id, key, value, timestamp],
        ).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
        Ok(())
    }
/*▗▄▄▄   ▗▄▖ 
  ▐▌  █ ▐▌ ▐▌
  ▐▌  █ ▐▌ ▐▌
  ▐▙▄▄▀ ▝▚▄▞*/
    /// Registra que algo 'hace' en un contexto específico.
    /// El `context_id` define el espacio (privado, público, derivado, etc.) en el que se guarda el verbo.
    pub fn do_(&self, conn: &Connection, context_id: &str, key: &str, value: &str) -> std::io::Result<()> {
        let timestamp = Self::now_timestamp();
        conn.execute(
            "INSERT INTO do_ (context_id, key, value, timestamp) VALUES (?1, ?2, ?3, ?4)",
            params![context_id, key, value, timestamp],
        ).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
        Ok(())
    }
/*▗▖ ▗▖ ▗▄▖ ▗▖  ▗▖▗▄▄▄▖
  ▐▌ ▐▌▐▌ ▐▌▐▌  ▐▌▐▌   
  ▐▛▀▜▌▐▛▀▜▌▐▌  ▐▌▐▛▀▀▘
  ▐▌ ▐▌▐▌ ▐▌ ▝▚▞▘ ▐▙▄▄▖*/
    /// Registra que algo 'tiene' en un contexto específico.
    /// El `context_id` define el espacio (privado, público, derivado, etc.) en el que se guarda el verbo.
    pub fn have(&self, conn: &Connection, context_id: &str, key: &str, value: &str) -> std::io::Result<()> {
        let timestamp = Self::now_timestamp();
        conn.execute(
            "INSERT INTO have (context_id, key, value, timestamp) VALUES (?1, ?2, ?3, ?4)",
            params![context_id, key, value, timestamp],
        ).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
        Ok(())
    }
/* ▗▄▖▗▄▄▄▖
  ▐▌ ▐▌ █  
  ▐▛▀▜▌ █  
  ▐▌ ▐▌ █ */
    /// Registra que algo 'está' en un contexto específico.
    /// El `context_id` define el espacio (privado, público, derivado, etc.) en el que se guarda el verbo.
    pub fn at(&self, conn: &Connection, context_id: &str, key: &str, value: &str) -> std::io::Result<()> {
        let timestamp = Self::now_timestamp();
        conn.execute(
            "INSERT INTO at (context_id, key, value, timestamp) VALUES (?1, ?2, ?3, ?4)",
            params![context_id, key, value, timestamp],
        ).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
        Ok(())
    }
/*▗▄▄▖ ▗▄▄▄▖▗▖    ▗▄▖▗▄▄▄▖▗▄▄▄▖
  ▐▌ ▐▌▐▌   ▐▌   ▐▌ ▐▌ █  ▐▌   
  ▐▛▀▚▖▐▛▀▀▘▐▌   ▐▛▀▜▌ █  ▐▛▀▀▘
  ▐▌ ▐▌▐▙▄▄▖▐▙▄▄▖▐▌ ▐▌ █  ▐▙▄▄▖*/
    /// Registra una relación entre entidades en un contexto.
    /// El `context_id` define el espacio (privado, público, derivado, etc.) en el que se guarda el verbo.
    pub fn relate(&self, conn: &Connection, context_id: &str, key: &str, value: &str) -> std::io::Result<()> {
        let timestamp = Self::now_timestamp();
        conn.execute(
            "INSERT INTO relate (context_id, key, target, value, timestamp) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![context_id, key, "", value, timestamp],
        ).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
        Ok(())
    }
/*▗▄▄▖ ▗▄▄▄▖ ▗▄▖  ▗▄▄▖▗▄▄▄▖
  ▐▌ ▐▌▐▌   ▐▌ ▐▌▐▌     █  
  ▐▛▀▚▖▐▛▀▀▘▐▛▀▜▌▐▌     █  
  ▐▌ ▐▌▐▙▄▄▖▐▌ ▐▌▝▚▄▄▖  █ */
    /// Registra una reacción (emoji) a un target dentro de un contexto.
    /// El `context_id` define el espacio (privado, público, derivado, etc.) en el que se guarda la reacción.
    pub fn react(&self, conn: &Connection, context_id: &str, key: &str, value: &str) -> std::io::Result<()> {
        let timestamp = Self::now_timestamp();
        conn.execute(
            "INSERT INTO react (context_id, key, target, emoji, timestamp) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![context_id, "", key, value, timestamp],
        ).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
        Ok(())
    }
/*Communication */
    /// Registra un mensaje dirigido a un target dentro de un contexto.
    /// El `context_id` define el espacio (privado, público, derivado, etc.) en el que se guarda el mensaje.
    pub fn communicate(&self, conn: &Connection, context_id: &str, key: &str, value: &str) -> std::io::Result<()> {
        let timestamp = Self::now_timestamp();
        conn.execute(
            "INSERT INTO communicate (context_id, key, target, message, timestamp) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![context_id, key, key, value, timestamp],
        ).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
        Ok(())
    }
    /// Recupera acciones registradas bajo un verbo específico en un `context_id`.
    /// Puede ser filtrado por campo y valor. Devuelve los resultados en orden cronológico inverso.
    /// El `context_id` representa un espacio derivado de varias identidades, secretos, dominios, o combinaciones.
    pub fn get(&self, conn: &Connection, verb: &str, context_id: Option<&str>, key: Option<&str>, value: Option<&str>, _json_path: Option<&str>, limit: Option<usize>, offset: Option<usize>, since: Option<&str>, until: Option<&str>) -> std::io::Result<Vec<(String, Action)>> {
        let verbs_list = ["be", "do_", "have", "at", "relate", "react", "communicate"];
        let mut results = Vec::new();

        let target_verbs: Vec<&str> = if verb == "all" {
            verbs_list.to_vec()
        } else {
            vec![verb]
        };

        for v in target_verbs {
            let table = match v {
                "do" => "do_",
                "react" | "communicate" => v,
                _ => v,
            };

            let mut query = match table {
                "react" => String::from("SELECT target AS key, emoji AS value, timestamp FROM react"),
                "communicate" => String::from("SELECT target AS key, message AS value, timestamp FROM communicate"),
                _ => format!("SELECT key, value, timestamp FROM {}", table),
            };

            let mut context_id_owned = None;
            let mut key_owned = None;
            let mut value_owned = None;
            let mut since_owned = None;
            let mut until_owned = None;

            let mut json_key_filter: Option<(String, String)> = None;
            if let Some(vv) = value {
                if vv.starts_with("json:") && vv.contains('=') {
                    let without_prefix = &vv[5..];
                    if let Some((json_key, json_val)) = without_prefix.split_once('=') {
                        json_key_filter = Some((json_key.to_string(), json_val.to_string()));
                    }
                }
            }

            if context_id.is_some() || key.is_some() || value.is_some() || since.is_some() || until.is_some() {
                query.push_str(" WHERE 1=1");
                if let Some(cid) = context_id {
                    context_id_owned = Some(cid.to_string());
                    query.push_str(" AND context_id = ?");
                }
                if let Some((json_k, json_v)) = &json_key_filter {
                    query.push_str(&format!(" AND json_valid(value) AND json_extract(value, '$.{}') = ?", json_k));
                    value_owned = Some(json_v.clone());
                } else if let Some(vv) = value {
                    if vv.starts_with("like:") {
                        let like_pattern = format!("%{}%", &vv[5..]);
                        value_owned = Some(like_pattern);
                        query.push_str(" AND value LIKE ?");
                    } else {
                        value_owned = Some(vv.to_string());
                        query.push_str(" AND value = ?");
                    }
                }
                if let Some(k) = key {
                    if k.starts_with("like:") {
                        let like_pattern = format!("%{}%", &k[5..]);
                        key_owned = Some(like_pattern);
                        query.push_str(" AND key LIKE ?");
                    } else {
                        key_owned = Some(k.to_string());
                        query.push_str(" AND key = ?");
                    }
                }
                if let Some(since_val) = since {
                    since_owned = Some(since_val.to_string());
                    query.push_str(" AND timestamp >= ?");
                }
                if let Some(until_val) = until {
                    until_owned = Some(until_val.to_string());
                    query.push_str(" AND timestamp <= ?");
                }
            } else {
                if let Some(k) = key {
                    if k.starts_with("like:") {
                        let like_pattern = format!("%{}%", &k[5..]);
                        key_owned = Some(like_pattern);
                        query.push_str(" WHERE key LIKE ?");
                    } else {
                        key_owned = Some(k.to_string());
                        query.push_str(" WHERE key = ?");
                    }
                }
                if let Some(since_val) = since {
                    since_owned = Some(since_val.to_string());
                    if query.contains("WHERE") {
                        query.push_str(" AND timestamp >= ?");
                    } else {
                        query.push_str(" WHERE timestamp >= ?");
                    }
                }
                if let Some(until_val) = until {
                    until_owned = Some(until_val.to_string());
                    if query.contains("WHERE") {
                        query.push_str(" AND timestamp <= ?");
                    } else {
                        query.push_str(" WHERE timestamp <= ?");
                    }
                }
            }

            query.push_str(" ORDER BY timestamp DESC");

            if let Some(lim) = limit {
                query.push_str(&format!(" LIMIT {}", lim));
            } else {
                query.push_str(" LIMIT 100");
            }

            if let Some(off) = offset {
                query.push_str(&format!(" OFFSET {}", off));
            }

            let mut arg_refs: Vec<&dyn rusqlite::ToSql> = Vec::new();

            if let Some(cid) = &context_id_owned {
                arg_refs.push(cid);
            }
            if let Some(k) = &key_owned {
                arg_refs.push(k);
            }
            if let Some(vv) = &value_owned {
                arg_refs.push(vv);
            }
            if let Some(since_v) = &since_owned {
                arg_refs.push(since_v);
            }
            if let Some(until_v) = &until_owned {
                arg_refs.push(until_v);
            }

            let mut stmt = match conn.prepare(&query) {
                Ok(s) => s,
                Err(e) => return Err(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())),
            };

            let rows = stmt
                .query_map(rusqlite::params_from_iter(arg_refs.iter()), |row| {
                    Ok(Action {
                        key: row.get(0)?,
                        value: row.get(1)?,
                        timestamp: row.get(2)?,
                    })
                })
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;

            for row in rows {
                if let Ok(action) = row {
                    results.push((v.to_string(), action));
                }
            }
        }

        results.sort_by(|a, b| b.1.timestamp.cmp(&a.1.timestamp));

        if !results.is_empty() {
            let first_ts = &results.last().unwrap().1.timestamp;
            let last_ts = &results.first().unwrap().1.timestamp;
            println!("⏳ Showing {} results from {} to {}", results.len(), first_ts, last_ts);
        } else {
            println!("⚠️ No se encontraron resultados.");
        }

        Ok(results)
    }
}