//utils/crypto.rs
use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    ChaCha20Poly1305, Key, Nonce,
};
use rand::RngCore;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("Encryption failed")]
    EncryptionFailed,
    #[error("Decryption failed")]
    DecryptionFailed,
    #[error("Invalid key length")]
    InvalidKeyLength,
}

// Derives a fixed-size key from a hash string
fn derive_key_from_hash(hash: &str) -> Result<Key, CryptoError> {
    let mut key_bytes = [0u8; 32];
    let hash_bytes = hash.as_bytes();

    if hash_bytes.len() < 32 {
        // Pad the key if it's too short
        key_bytes[..hash_bytes.len()].copy_from_slice(hash_bytes);
    } else {
        key_bytes.copy_from_slice(&hash_bytes[..32]);
    }

    Ok(Key::from_slice(&key_bytes).clone())
}

pub fn encrypt_string(hash: &str, plaintext: &str) -> Result<Vec<u8>, CryptoError> {
    let key = derive_key_from_hash(hash)?;
    let cipher = ChaCha20Poly1305::new(&key);
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| CryptoError::EncryptionFailed)?;

    // Prepend nonce to the result
    let mut result = nonce_bytes.to_vec();
    result.extend(ciphertext);
    Ok(result)
}

pub fn decrypt_string(hash: &str, ciphertext: &[u8]) -> Result<String, CryptoError> {
    let key = derive_key_from_hash(hash)?;
    let cipher = ChaCha20Poly1305::new(&key);

    if ciphertext.len() < 12 {
        return Err(CryptoError::DecryptionFailed);
    }

    let (nonce_bytes, cipher_bytes) = ciphertext.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let decrypted = cipher
        .decrypt(nonce, cipher_bytes)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    String::from_utf8(decrypted).map_err(|_| CryptoError::DecryptionFailed)
}