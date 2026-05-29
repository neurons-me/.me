use aes_gcm::aead::{Aead, KeyInit, OsRng, generic_array::GenericArray};
use aes_gcm::{Aes256Gcm, Nonce}; // 96-bits nonce
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;
use hmac::Hmac;
use rand::RngCore;
use base64::{engine::general_purpose, Engine as _};
use qrcode::QrCode;
use qrcode::render::unicode;
use image::Luma;
use std::fs;
use std::path::Path;
use std::io::{self, Write};
use rusqlite::{Connection, params};
use serde_json::json;

type HmacSha256 = Hmac<Sha256>;

/// Deriva una clave AES-256 (32 bytes) desde una passphrase y salt (16 bytes)
fn derive_key(passphrase: &str, salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    // PBKDF2 con 100_000 iteraciones (ajustable según perfil de seguridad)
    let iterations: u32 = 100_000;
    pbkdf2_hmac::<HmacSha256>(
        passphrase.as_bytes(),
        salt,
        iterations,
        &mut key,
    );
    key
}

/// Cifra `plaintext` con passphrase. Devuelve un string base64 que concatena salt||nonce||ciphertext
pub fn encrypt_payload_to_base64(plaintext: &str, passphrase: &str) -> Result<String, String> {
    // salt (16 bytes) y nonce (12 bytes)
    let mut salt = [0u8; 16];
    let mut nonce_bytes = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut salt);
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);

    let key_bytes = derive_key(passphrase, &salt);
    let key = GenericArray::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let nonce = Nonce::from_slice(&nonce_bytes); // 96-bit nonce
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("encrypt error: {}", e))?;

    // Output: salt || nonce || ciphertext (todos bytes), luego base64
    let mut out = Vec::with_capacity(16 + 12 + ciphertext.len());
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);

    Ok(general_purpose::STANDARD.encode(&out))
}

/// Dado el base64 (salt||nonce||ciphertext) y la passphrase, retorna plaintext
pub fn decrypt_base64_to_payload(b64: &str, passphrase: &str) -> Result<String, String> {
    let bytes = general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("base64 decode error: {}", e))?;

    if bytes.len() < 16 + 12 + 1 {
        return Err("ciphertext too short".into());
    }
    let salt = &bytes[0..16];
    let nonce_bytes = &bytes[16..28];
    let ciphertext = &bytes[28..];

    let key_bytes = derive_key(passphrase, salt);
    let key = GenericArray::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("decrypt error: {}", e))?;

    String::from_utf8(plaintext_bytes).map_err(|e| format!("utf8 error: {}", e))
}

/// Genera QR (unicode) en terminal y salva seal.png con el blob base64
pub fn render_encrypted_qr_and_png(base64_blob: &str, ctx_path: &Path) -> Result<(), String> {
    let code = QrCode::new(base64_blob.as_bytes()).map_err(|e| format!("qr error: {}", e))?;
    let qr_text = code.render::<unicode::Dense1x2>().quiet_zone(true).build();
    println!();
    println!("{}", "🔏 Encrypted seal (scan to import):".bright_white().bold());
    println!();
    println!("{}", qr_text);
    println!();

    // imagen PNG
    let img = code.render::<Luma<u8>>().build();
    let seal_path = ctx_path.join("seal_encrypted.png");
    img.save(&seal_path).map_err(|e| format!("save png error: {}", e))?;
    println!("(also saved as {})", seal_path.display());
    Ok(())
}

/// Helper: leer passphrase de manera segura (no eco)
pub fn prompt_passphrase(prompt: &str) -> Result<String, String> {
    print!("{}", prompt);
    io::stdout().flush().map_err(|e| format!("{}", e))?;
    rpassword::read_password().map_err(|e| format!("{}", e))
}

/// Crea un blob híbrido con formato BASE64(pub)||"."||BASE64(enc_blob)
pub fn create_hybrid_blob(public_key: &str, plaintext_payload: &str, passphrase: &str) -> Result<String, String> {
    let enc_blob = encrypt_payload_to_base64(plaintext_payload, passphrase)?;
    let pub_b64 = general_purpose::STANDARD.encode(public_key.as_bytes());
    Ok(format!("{}.{})", pub_b64, enc_blob))
}

/// Parsea el blob híbrido y retorna (public_key, encrypted_blob)
pub fn parse_hybrid_blob(hybrid: &str) -> Result<(String, String), String> {
    let parts: Vec<&str> = hybrid.splitn(2, '.').collect();
    if parts.len() != 2 {
        return Err("invalid hybrid blob format".into());
    }
    let pub_bytes = general_purpose::STANDARD
        .decode(parts[0])
        .map_err(|e| format!("base64 decode error for public key: {}", e))?;
    let public_key = String::from_utf8(pub_bytes).map_err(|e| format!("utf8 error for public key: {}", e))?;
    let enc_blob = parts[1].to_string();

    // sanity checks
    if public_key.is_empty() {
        return Err("empty public key in hybrid blob".into());
    }
    if enc_blob.is_empty() {
        return Err("empty encrypted blob in hybrid blob".into());
    }

    Ok((public_key, enc_blob))
}

/// Renderiza QR híbrido con public key visible y salva imagen PNG
pub fn render_hybrid_qr(public_key: &str, plaintext_payload: &str, passphrase: &str, ctx_path: &Path) -> Result<(), String> {
    let hybrid_blob = create_hybrid_blob(public_key, plaintext_payload, passphrase)?;
    let code = QrCode::new(hybrid_blob.as_bytes()).map_err(|e| format!("qr error: {}", e))?;
    let qr_text = code.render::<unicode::Dense1x2>().quiet_zone(true).build();

    println!();
    println!("{}", "🔏 Hybrid Encrypted Seal (scan to import):".bright_white().bold());
    println!("{}", "Public Key (visible, not encrypted):".bright_yellow().bold());
    println!("{}", public_key.bright_yellow().bold());
    println!("{}", "──────────────────────────────────────────────".bright_black());
    println!("{}", "Encrypted Payload (encrypted, base64):".bright_white().bold());
    println!();
    println!("{}", qr_text);
    println!();

    // Print the hybrid blob structure showing visible base64-encoded public key and encrypted blob
    println!("{}", format!("Hybrid Blob Structure: <base64(pubkey)>.<base64(encrypted_blob)>").bright_black());
    println!("{}", hybrid_blob.bright_black());
    println!();

    let img = code.render::<Luma<u8>>().build();
    let seal_path = ctx_path.join("seal_hybrid_encrypted.png");
    img.save(&seal_path).map_err(|e| format!("save png error: {}", e))?;
    println!("(also saved as {})", seal_path.display());
    Ok(())
}

pub fn from_sqlite_to_qr(db_path: &Path, passphrase: &str, ctx_path: &Path) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| format!("failed to open db: {}", e))?;
    let mut stmt = conn.prepare("SELECT username, public_key, context_id, version FROM me")
        .map_err(|e| format!("failed to prepare query: {}", e))?;
    let mut rows = stmt.query(params![]).map_err(|e| format!("failed to execute query: {}", e))?;

    while let Some(row) = rows.next().map_err(|e| format!("failed to fetch row: {}", e))? {
        let username: String = row.get(0).map_err(|e| format!("failed to get username: {}", e))?;
        let public_key: String = row.get(1).map_err(|e| format!("failed to get public_key: {}", e))?;
        let context_id: String = row.get(2).map_err(|e| format!("failed to get context_id: {}", e))?;
        let version: String = row.get(3).map_err(|e| format!("failed to get version: {}", e))?;

        let json_obj = json!({
            "username": username,
            "context_id": context_id,
            "version": version
        });
        let json_string = json_obj.to_string();

        render_hybrid_qr(&public_key, &json_string, passphrase, ctx_path)?;
        println!("✅ Generated hybrid QR for {}", username);
    }

    Ok(())
}