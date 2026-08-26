use std::fmt;

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use hkdf::Hkdf;
use sha2::Sha256;
use sha3::{Digest, Keccak256};

use super::secret_material::{base64_url_decode, base64_url_encode};

const IDENTITY_HASH_DOMAIN: &str = "this.me/identity:v1::";
const COMPOUND_SEED_DOMAIN: &str = "me.seed/compound:v1::";
const PROVE_KDF_INFO: &str = "me.prove.v1";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProofInput {
    pub root_namespace: String,
    pub challenge: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProofResult {
    pub identity_hash: String,
    pub expression: String,
    pub namespace: String,
    pub root_namespace: String,
    pub public_key: String,
    pub message: String,
    pub signature: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProofError {
    EmptySeed,
    ActiveExpressionRequired,
    RootNamespaceRequired,
    HkdfExpandFailed,
    InvalidSigningSeed,
    InvalidPublicKey,
    InvalidSignature,
}

impl fmt::Display for ProofError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptySeed => write!(f, "seed material is required"),
            Self::ActiveExpressionRequired => write!(f, "ACTIVE_EXPRESSION_REQUIRED"),
            Self::RootNamespaceRequired => write!(f, "ROOT_NAMESPACE_REQUIRED"),
            Self::HkdfExpandFailed => write!(f, "proof HKDF expansion failed"),
            Self::InvalidSigningSeed => write!(f, "Ed25519 signing seed must be exactly 32 bytes"),
            Self::InvalidPublicKey => write!(f, "public key is not a valid Ed25519 key"),
            Self::InvalidSignature => write!(f, "signature is not a valid Ed25519 signature"),
        }
    }
}

impl std::error::Error for ProofError {}

pub fn derive_compound_seed(who: &str, secret: &str) -> String {
    keccak256_hex(format!("{COMPOUND_SEED_DOMAIN}{who}::{secret}").as_bytes())
}

pub fn derive_identity_hash(seed: &str) -> String {
    keccak256_hex(format!("{IDENTITY_HASH_DOMAIN}{seed}").as_bytes())
}

pub fn derive_branch_proof_seed(seed: &str, expression: &str) -> Result<[u8; 32], ProofError> {
    let expression = expression.trim();
    if expression.is_empty() {
        return Err(ProofError::ActiveExpressionRequired);
    }
    let ikm = decode_seed_material(seed)?;
    let hkdf = Hkdf::<Sha256>::new(Some(PROVE_KDF_INFO.as_bytes()), &ikm);
    let mut out = [0_u8; 32];
    hkdf.expand(expression.as_bytes(), &mut out)
        .map_err(|_| ProofError::HkdfExpandFailed)?;
    Ok(out)
}

pub fn prove_with_timestamp(
    seed: &str,
    expression: &str,
    root_namespace: &str,
    challenge: Option<&str>,
    timestamp: u64,
) -> Result<ProofResult, ProofError> {
    let expression = expression.trim();
    if expression.is_empty() {
        return Err(ProofError::ActiveExpressionRequired);
    }
    let root_namespace = normalize_root_namespace(root_namespace);
    if root_namespace.is_empty() {
        return Err(ProofError::RootNamespaceRequired);
    }

    let identity_hash = derive_identity_hash(seed);
    let namespace = format!("{expression}.{root_namespace}");
    let branch_seed = derive_branch_proof_seed(seed, expression)?;
    let signing_key = SigningKey::from_bytes(&branch_seed);
    let verifying_key = signing_key.verifying_key();
    let challenge = challenge.map(str::to_string);
    let message = normalize_proof_payload(
        &identity_hash,
        expression,
        &namespace,
        &root_namespace,
        challenge.as_deref(),
        timestamp,
    );
    let signature = signing_key.sign(message.as_bytes());

    Ok(ProofResult {
        identity_hash,
        expression: expression.to_string(),
        namespace,
        root_namespace,
        public_key: base64_url_encode(verifying_key.as_bytes()),
        message,
        signature: base64_url_encode(&signature.to_bytes()),
        timestamp,
    })
}

pub fn verify_ed25519_signature(public_key: &str, message: &str, signature: &str) -> bool {
    let Some(public_key) = base64_url_decode(public_key) else {
        return false;
    };
    let Ok(public_key) = <[u8; 32]>::try_from(public_key.as_slice()) else {
        return false;
    };
    let Ok(verifying_key) = VerifyingKey::from_bytes(&public_key) else {
        return false;
    };
    let Some(signature) = base64_url_decode(signature) else {
        return false;
    };
    let Ok(signature) = Signature::from_slice(&signature) else {
        return false;
    };
    verifying_key.verify(message.as_bytes(), &signature).is_ok()
}

pub fn normalize_root_namespace(root_namespace: &str) -> String {
    root_namespace
        .trim()
        .strip_prefix("http://")
        .or_else(|| root_namespace.trim().strip_prefix("https://"))
        .unwrap_or(root_namespace.trim())
        .trim_end_matches('/')
        .trim_start_matches('.')
        .trim_end_matches('.')
        .to_string()
}

pub fn normalize_proof_payload(
    identity_hash: &str,
    expression: &str,
    namespace: &str,
    root_namespace: &str,
    challenge: Option<&str>,
    timestamp: u64,
) -> String {
    // This mirrors TypeScript normalizeProofMessage(payload): object keys sorted
    // lexicographically, JSON string escaping for string leaves, null challenge
    // when omitted.
    format!(
        "{{\"challenge\":{},\"expression\":{},\"identityHash\":{},\"namespace\":{},\"rootNamespace\":{},\"timestamp\":{}}}",
        json_string_or_null(challenge),
        json_string(expression),
        json_string(identity_hash),
        json_string(namespace),
        json_string(root_namespace),
        timestamp,
    )
}

fn decode_seed_material(seed: &str) -> Result<Vec<u8>, ProofError> {
    let raw = seed.trim();
    if raw.is_empty() {
        return Err(ProofError::EmptySeed);
    }
    let normalized = raw.strip_prefix("0x").unwrap_or(raw);
    if !normalized.is_empty()
        && normalized.len().is_multiple_of(2)
        && normalized.chars().all(|ch| ch.is_ascii_hexdigit())
    {
        return hex_decode(normalized).ok_or(ProofError::EmptySeed);
    }
    Ok(raw.as_bytes().to_vec())
}

fn keccak256_hex(bytes: &[u8]) -> String {
    let digest = Keccak256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn hex_decode(input: &str) -> Option<Vec<u8>> {
    if !input.len().is_multiple_of(2) {
        return None;
    }
    (0..input.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&input[index..index + 2], 16).ok())
        .collect()
}

fn json_string_or_null(value: Option<&str>) -> String {
    value.map(json_string).unwrap_or_else(|| "null".to_string())
}

fn json_string(value: &str) -> String {
    let mut out = String::from("\"");
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            ch if ch <= '\u{1f}' => out.push_str(&format!("\\u{:04x}", ch as u32)),
            ch => out.push(ch),
        }
    }
    out.push('"');
    out
}
