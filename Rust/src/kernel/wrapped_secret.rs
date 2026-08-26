use std::collections::BTreeMap;
use std::fmt;

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use hkdf::Hkdf;
use p256::ecdh::diffie_hellman;
use p256::elliptic_curve::sec1::ToEncodedPoint;
use p256::{PublicKey, SecretKey};
use sha2::Sha256;

use super::secret_material::{base64_url_decode, base64_url_encode};
use super::Value;

const WRAPPED_SECRET_INFO: &[u8] = b"this.me/wrapped-secret/v1";
const P256_SCALAR_LENGTH: usize = 32;
const P256_COORD_LENGTH: usize = 32;
const WRAPPED_SECRET_SALT_LENGTH: usize = 32;
const WRAPPED_SECRET_IV_LENGTH: usize = 12;
const AES_GCM_TAG_LENGTH: usize = 16;

#[derive(Clone, PartialEq, Eq)]
pub struct P256PrivateKey([u8; P256_SCALAR_LENGTH]);

impl fmt::Debug for P256PrivateKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("P256PrivateKey")
            .field(&"<redacted>")
            .finish()
    }
}

impl P256PrivateKey {
    pub fn from_bytes(bytes: [u8; P256_SCALAR_LENGTH]) -> Result<Self, WrappedSecretError> {
        SecretKey::from_slice(&bytes).map_err(|_| WrappedSecretError::InvalidPrivateKey)?;
        Ok(Self(bytes))
    }

    pub fn from_slice(bytes: &[u8]) -> Result<Self, WrappedSecretError> {
        let bytes: [u8; P256_SCALAR_LENGTH] = bytes
            .try_into()
            .map_err(|_| WrappedSecretError::InvalidPrivateKey)?;
        Self::from_bytes(bytes)
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        self.0.to_vec()
    }

    fn as_secret_key(&self) -> Result<SecretKey, WrappedSecretError> {
        SecretKey::from_slice(&self.0).map_err(|_| WrappedSecretError::InvalidPrivateKey)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct P256PublicKeyCoordinates {
    pub kty: String,
    pub crv: String,
    pub x: String,
    pub y: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct P256KeyPair {
    pub private_key: P256PrivateKey,
    pub public_key: P256PublicKeyCoordinates,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WrappedSecretOutput {
    Bytes,
    Utf8,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WrappedSecretCleartext {
    Bytes(Vec<u8>),
    Utf8(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WrappedSecretError {
    RandomUnavailable,
    InvalidPrivateKey,
    InvalidPublicKey,
    InvalidEnvelope,
    UnsupportedVersion(u64),
    UnsupportedKeyExchange,
    UnsupportedKdf,
    UnsupportedAead,
    InvalidBase64Url,
    HkdfExpandFailed,
    EncryptFailed,
    DecryptFailed,
    Utf8Failed,
}

impl fmt::Display for WrappedSecretError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RandomUnavailable => write!(f, "secure random bytes are unavailable"),
            Self::InvalidPrivateKey => write!(f, "private key is not a valid P-256 scalar"),
            Self::InvalidPublicKey => write!(f, "public key is not a valid P-256 EC key"),
            Self::InvalidEnvelope => write!(f, "wrapped secret envelope is invalid"),
            Self::UnsupportedVersion(version) => {
                write!(f, "unsupported wrapped secret version: {version}")
            }
            Self::UnsupportedKeyExchange => write!(f, "unsupported key exchange algorithm"),
            Self::UnsupportedKdf => write!(f, "unsupported KDF"),
            Self::UnsupportedAead => write!(f, "unsupported AEAD"),
            Self::InvalidBase64Url => write!(f, "invalid base64url material in wrapped secret"),
            Self::HkdfExpandFailed => write!(f, "HKDF expansion failed"),
            Self::EncryptFailed => write!(f, "wrapped secret encryption failed"),
            Self::DecryptFailed => write!(f, "wrapped secret decryption failed"),
            Self::Utf8Failed => write!(f, "wrapped secret cleartext is not valid UTF-8"),
        }
    }
}

impl std::error::Error for WrappedSecretError {}

pub fn generate_p256_key_pair() -> Result<P256KeyPair, WrappedSecretError> {
    let private_key = generate_p256_private_key()?;
    let public_key = export_p256_public_key_from_private(&private_key)?;
    Ok(P256KeyPair {
        private_key,
        public_key,
    })
}

pub fn export_p256_public_key_from_private(
    private_key: &P256PrivateKey,
) -> Result<P256PublicKeyCoordinates, WrappedSecretError> {
    let secret = private_key.as_secret_key()?;
    export_p256_public_key(&secret.public_key())
}

pub fn wrap_secret_v1(
    secret: impl AsRef<[u8]>,
    recipient_public_key: &P256PublicKeyCoordinates,
    kid: &str,
    class: &str,
    public_key: Option<&P256PublicKeyCoordinates>,
    policy: Option<Value>,
) -> Result<Value, WrappedSecretError> {
    let recipient_public_key = import_p256_public_key(recipient_public_key)?;
    let ephemeral_private_key = generate_p256_private_key()?;
    let ephemeral_secret = ephemeral_private_key.as_secret_key()?;
    let shared_secret = derive_shared_secret(&ephemeral_secret, &recipient_public_key);

    let salt = random_bytes::<WRAPPED_SECRET_SALT_LENGTH>()?;
    let iv = random_bytes::<WRAPPED_SECRET_IV_LENGTH>()?;
    let aes_key = derive_wrapping_aes_key(&shared_secret, &salt)?;
    let cipher =
        Aes256Gcm::new_from_slice(&aes_key).map_err(|_| WrappedSecretError::EncryptFailed)?;
    let sealed = cipher
        .encrypt(Nonce::from_slice(&iv), secret.as_ref())
        .map_err(|_| WrappedSecretError::EncryptFailed)?;
    if sealed.len() < AES_GCM_TAG_LENGTH {
        return Err(WrappedSecretError::EncryptFailed);
    }
    let (ciphertext, tag) = sealed.split_at(sealed.len() - AES_GCM_TAG_LENGTH);
    let ephemeral_public_key = export_p256_public_key(&ephemeral_secret.public_key())?;

    let mut root = BTreeMap::new();
    root.insert("version".to_string(), Value::from(1_u64));
    root.insert("class".to_string(), Value::from(class.trim().to_string()));
    root.insert("kid".to_string(), Value::from(kid.trim().to_string()));
    if let Some(public_key) = public_key {
        root.insert("publicKey".to_string(), public_key_to_value(public_key));
    }
    root.insert(
        "encryption".to_string(),
        encryption_to_value(EncryptionParts {
            iv: &iv,
            salt: &salt,
            tag,
            ciphertext,
            ephemeral_public_key: &ephemeral_public_key,
        }),
    );
    if let Some(policy) = policy {
        root.insert("policy".to_string(), policy);
    }

    Ok(Value::Object(root))
}

pub fn unwrap_secret_v1(
    envelope: &Value,
    recipient_private_key: &P256PrivateKey,
    output: WrappedSecretOutput,
) -> Result<WrappedSecretCleartext, WrappedSecretError> {
    let envelope = parse_envelope(envelope)?;
    if envelope.version != 1 {
        return Err(WrappedSecretError::UnsupportedVersion(envelope.version));
    }
    if envelope.kex != "ECDH-ES" {
        return Err(WrappedSecretError::UnsupportedKeyExchange);
    }
    if envelope.kdf != "HKDF-SHA-256" {
        return Err(WrappedSecretError::UnsupportedKdf);
    }
    if envelope.aead != "AES-256-GCM" {
        return Err(WrappedSecretError::UnsupportedAead);
    }

    let ephemeral_public_key = import_p256_public_key(&envelope.ephemeral_public_key)?;
    let recipient_secret = recipient_private_key.as_secret_key()?;
    let shared_secret = derive_shared_secret(&recipient_secret, &ephemeral_public_key);
    let aes_key = derive_wrapping_aes_key(&shared_secret, &envelope.salt)?;
    let cipher =
        Aes256Gcm::new_from_slice(&aes_key).map_err(|_| WrappedSecretError::DecryptFailed)?;
    let mut payload = envelope.ciphertext;
    payload.extend_from_slice(&envelope.tag);
    let clear = cipher
        .decrypt(Nonce::from_slice(&envelope.iv), payload.as_slice())
        .map_err(|_| WrappedSecretError::DecryptFailed)?;

    match output {
        WrappedSecretOutput::Bytes => Ok(WrappedSecretCleartext::Bytes(clear)),
        WrappedSecretOutput::Utf8 => String::from_utf8(clear)
            .map(WrappedSecretCleartext::Utf8)
            .map_err(|_| WrappedSecretError::Utf8Failed),
    }
}

fn generate_p256_private_key() -> Result<P256PrivateKey, WrappedSecretError> {
    loop {
        let bytes = random_bytes::<P256_SCALAR_LENGTH>()?;
        if let Ok(private_key) = P256PrivateKey::from_bytes(bytes) {
            return Ok(private_key);
        }
    }
}

fn random_bytes<const N: usize>() -> Result<[u8; N], WrappedSecretError> {
    let mut out = [0_u8; N];
    getrandom::getrandom(&mut out).map_err(|_| WrappedSecretError::RandomUnavailable)?;
    Ok(out)
}

fn import_p256_public_key(
    public_key: &P256PublicKeyCoordinates,
) -> Result<PublicKey, WrappedSecretError> {
    if public_key.kty != "EC" || public_key.crv != "P-256" {
        return Err(WrappedSecretError::InvalidPublicKey);
    }
    let x = base64_url_decode(&public_key.x).ok_or(WrappedSecretError::InvalidBase64Url)?;
    let y = base64_url_decode(&public_key.y).ok_or(WrappedSecretError::InvalidBase64Url)?;
    if x.len() != P256_COORD_LENGTH || y.len() != P256_COORD_LENGTH {
        return Err(WrappedSecretError::InvalidPublicKey);
    }
    let mut sec1 = Vec::with_capacity(1 + P256_COORD_LENGTH * 2);
    sec1.push(0x04);
    sec1.extend_from_slice(&x);
    sec1.extend_from_slice(&y);
    PublicKey::from_sec1_bytes(&sec1).map_err(|_| WrappedSecretError::InvalidPublicKey)
}

fn export_p256_public_key(
    public_key: &PublicKey,
) -> Result<P256PublicKeyCoordinates, WrappedSecretError> {
    let point = public_key.to_encoded_point(false);
    let x = point.x().ok_or(WrappedSecretError::InvalidPublicKey)?;
    let y = point.y().ok_or(WrappedSecretError::InvalidPublicKey)?;
    Ok(P256PublicKeyCoordinates {
        kty: "EC".to_string(),
        crv: "P-256".to_string(),
        x: base64_url_encode(x),
        y: base64_url_encode(y),
    })
}

fn derive_shared_secret(secret_key: &SecretKey, public_key: &PublicKey) -> [u8; 32] {
    let shared_secret = diffie_hellman(secret_key.to_nonzero_scalar(), public_key.as_affine());
    let mut out = [0_u8; 32];
    out.copy_from_slice(shared_secret.raw_secret_bytes().as_slice());
    out
}

fn derive_wrapping_aes_key(
    shared_secret: &[u8],
    salt: &[u8],
) -> Result<[u8; 32], WrappedSecretError> {
    let hkdf = Hkdf::<Sha256>::new(Some(salt), shared_secret);
    let mut out = [0_u8; 32];
    hkdf.expand(WRAPPED_SECRET_INFO, &mut out)
        .map_err(|_| WrappedSecretError::HkdfExpandFailed)?;
    Ok(out)
}

struct EncryptionParts<'a> {
    iv: &'a [u8],
    salt: &'a [u8],
    tag: &'a [u8],
    ciphertext: &'a [u8],
    ephemeral_public_key: &'a P256PublicKeyCoordinates,
}

fn encryption_to_value(parts: EncryptionParts<'_>) -> Value {
    let mut encryption = BTreeMap::new();
    encryption.insert("kex".to_string(), Value::from("ECDH-ES"));
    encryption.insert("kdf".to_string(), Value::from("HKDF-SHA-256"));
    encryption.insert("aead".to_string(), Value::from("AES-256-GCM"));
    encryption.insert("iv".to_string(), Value::from(base64_url_encode(parts.iv)));
    encryption.insert(
        "salt".to_string(),
        Value::from(base64_url_encode(parts.salt)),
    );
    encryption.insert("tag".to_string(), Value::from(base64_url_encode(parts.tag)));
    encryption.insert(
        "ciphertext".to_string(),
        Value::from(base64_url_encode(parts.ciphertext)),
    );
    encryption.insert(
        "ephemeralPK".to_string(),
        public_key_to_value(parts.ephemeral_public_key),
    );
    Value::Object(encryption)
}

fn public_key_to_value(public_key: &P256PublicKeyCoordinates) -> Value {
    let mut object = BTreeMap::new();
    object.insert("kty".to_string(), Value::from(public_key.kty.clone()));
    object.insert("crv".to_string(), Value::from(public_key.crv.clone()));
    object.insert("x".to_string(), Value::from(public_key.x.clone()));
    object.insert("y".to_string(), Value::from(public_key.y.clone()));
    Value::Object(object)
}

struct ParsedEnvelope {
    version: u64,
    kex: String,
    kdf: String,
    aead: String,
    iv: Vec<u8>,
    salt: Vec<u8>,
    tag: Vec<u8>,
    ciphertext: Vec<u8>,
    ephemeral_public_key: P256PublicKeyCoordinates,
}

fn parse_envelope(envelope: &Value) -> Result<ParsedEnvelope, WrappedSecretError> {
    let root = object_ref(envelope)?;
    let version = number_field(root, "version")?;
    let encryption = object_ref(field(root, "encryption")?)?;
    let iv = base64_field(encryption, "iv")?;
    let salt = base64_field(encryption, "salt")?;
    let tag = base64_field(encryption, "tag")?;
    let ciphertext = base64_field(encryption, "ciphertext")?;
    let ephemeral_public_key = public_key_from_value(field(encryption, "ephemeralPK")?)?;

    Ok(ParsedEnvelope {
        version,
        kex: string_field(encryption, "kex")?,
        kdf: string_field(encryption, "kdf")?,
        aead: string_field(encryption, "aead")?,
        iv,
        salt,
        tag,
        ciphertext,
        ephemeral_public_key,
    })
}

pub(crate) fn public_key_from_value(
    value: &Value,
) -> Result<P256PublicKeyCoordinates, WrappedSecretError> {
    let object = object_ref(value)?;
    Ok(P256PublicKeyCoordinates {
        kty: string_field(object, "kty")?,
        crv: string_field(object, "crv")?,
        x: string_field(object, "x")?,
        y: string_field(object, "y")?,
    })
}

fn object_ref(value: &Value) -> Result<&BTreeMap<String, Value>, WrappedSecretError> {
    let Value::Object(object) = value else {
        return Err(WrappedSecretError::InvalidEnvelope);
    };
    Ok(object)
}

fn field<'a>(
    object: &'a BTreeMap<String, Value>,
    key: &str,
) -> Result<&'a Value, WrappedSecretError> {
    object.get(key).ok_or(WrappedSecretError::InvalidEnvelope)
}

fn string_field(object: &BTreeMap<String, Value>, key: &str) -> Result<String, WrappedSecretError> {
    let Value::String(value) = field(object, key)? else {
        return Err(WrappedSecretError::InvalidEnvelope);
    };
    Ok(value.clone())
}

fn number_field(object: &BTreeMap<String, Value>, key: &str) -> Result<u64, WrappedSecretError> {
    let Value::Number(value) = field(object, key)? else {
        return Err(WrappedSecretError::InvalidEnvelope);
    };
    if *value < 0.0 || value.fract() != 0.0 {
        return Err(WrappedSecretError::InvalidEnvelope);
    }
    Ok(*value as u64)
}

fn base64_field(
    object: &BTreeMap<String, Value>,
    key: &str,
) -> Result<Vec<u8>, WrappedSecretError> {
    let value = string_field(object, key)?;
    base64_url_decode(&value).ok_or(WrappedSecretError::InvalidBase64Url)
}
