use sha3::{Digest, Keccak256};

const KECCAK_HMAC_BLOCK_SIZE: usize = 136;
const BLOB_V2_MAGIC: [u8; 3] = [0xfe, 0x6d, 0x65];
const BLOB_V3_VERSION: u8 = 0x03;
const BLOB_V3_NONCE_LENGTH: usize = 16;
const BLOB_V3_TAG_LENGTH: usize = 16;
const BLOB_BASE64URL_PREFIX: &str = "b64u:";
const V3_KDF_LABEL: &str = "this.me/blob/v3/kdf";
const V3_ENC_INFO_LABEL: &str = "this.me/blob/v3/enc";
const V3_MAC_INFO_LABEL: &str = "this.me/blob/v3/mac";
const V3_STREAM_INFO_LABEL: &str = "this.me/blob/v3/stream";
const V3_TAG_INFO_LABEL: &str = "this.me/blob/v3/tag";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlobV3DerivedKeys {
    pub enc_key: [u8; 32],
    pub mac_key: [u8; 32],
    pub path_context: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecretMaterialPurpose {
    Branch,
    Value,
    Enc,
    Mac,
}

impl SecretMaterialPurpose {
    fn as_label(self) -> &'static str {
        match self {
            Self::Branch => "this.me/blob/v3/branch",
            Self::Value => "this.me/blob/v3/value",
            Self::Enc => "this.me/blob/v3/enc",
            Self::Mac => "this.me/blob/v3/mac",
        }
    }
}

pub fn derive_secret_material_v3(
    chain: &[Vec<u8>],
    purpose: SecretMaterialPurpose,
) -> Option<[u8; 32]> {
    if chain.len() < 6 {
        return None;
    }

    let mut transcript = Vec::new();
    transcript.extend_from_slice(V3_KDF_LABEL.as_bytes());
    transcript.extend_from_slice(&length_prefixed(purpose.as_label().as_bytes()));
    for segment in chain {
        transcript.extend_from_slice(&length_prefixed(segment));
    }

    Some(keccak256(&transcript))
}

pub fn derive_blob_v3_keys(
    chain: &[Vec<u8>],
    mode: SecretMaterialPurpose,
    path: &[String],
) -> Option<BlobV3DerivedKeys> {
    let base_key = derive_secret_material_v3(chain, mode)?;
    let path_context = path.join(".").into_bytes();
    let enc_key = hmac_keccak256(
        &base_key,
        &[
            V3_ENC_INFO_LABEL.as_bytes(),
            &length_prefixed(&path_context),
        ],
    );
    let mac_key = hmac_keccak256(
        &base_key,
        &[
            V3_MAC_INFO_LABEL.as_bytes(),
            &length_prefixed(&path_context),
        ],
    );

    Some(BlobV3DerivedKeys {
        enc_key,
        mac_key,
        path_context,
    })
}

pub fn encrypt_blob_v3_cleartext(
    cleartext: &[u8],
    keys: &BlobV3DerivedKeys,
    nonce: [u8; BLOB_V3_NONCE_LENGTH],
) -> String {
    let keystream =
        generate_blob_v3_keystream(&keys.enc_key, &nonce, &keys.path_context, cleartext.len());
    let ciphertext = cleartext
        .iter()
        .zip(keystream.iter())
        .map(|(clear, key)| clear ^ key)
        .collect::<Vec<_>>();
    let header = blob_v3_header();
    let tag = compute_blob_v3_tag(
        &keys.mac_key,
        &header,
        &nonce,
        &keys.path_context,
        &ciphertext,
    );

    let mut encoded = Vec::new();
    encoded.extend_from_slice(&header);
    encoded.extend_from_slice(&nonce);
    encoded.extend_from_slice(&tag);
    encoded.extend_from_slice(&ciphertext);
    format!("{BLOB_BASE64URL_PREFIX}{}", base64_url_encode(&encoded))
}

pub fn decrypt_blob_v3_cleartext(blob: &str, keys: &BlobV3DerivedKeys) -> Option<Vec<u8>> {
    let bytes = blob_to_bytes(blob)?;
    let header_length = BLOB_V2_MAGIC.len() + 1;
    let min_length = header_length + BLOB_V3_NONCE_LENGTH + BLOB_V3_TAG_LENGTH + 1;
    if bytes.len() < min_length {
        return None;
    }
    if bytes[..BLOB_V2_MAGIC.len()] != BLOB_V2_MAGIC {
        return None;
    }
    if bytes[BLOB_V2_MAGIC.len()] != BLOB_V3_VERSION {
        return None;
    }

    let header = &bytes[..header_length];
    let nonce_start = header_length;
    let tag_start = nonce_start + BLOB_V3_NONCE_LENGTH;
    let ciphertext_start = tag_start + BLOB_V3_TAG_LENGTH;
    let nonce = &bytes[nonce_start..tag_start];
    let tag = &bytes[tag_start..ciphertext_start];
    let ciphertext = &bytes[ciphertext_start..];
    let expected_tag =
        compute_blob_v3_tag(&keys.mac_key, header, nonce, &keys.path_context, ciphertext);
    if !constant_time_equal(tag, &expected_tag) {
        return None;
    }

    let keystream =
        generate_blob_v3_keystream(&keys.enc_key, nonce, &keys.path_context, ciphertext.len());
    Some(
        ciphertext
            .iter()
            .zip(keystream.iter())
            .map(|(cipher, key)| cipher ^ key)
            .collect(),
    )
}

pub fn lineage_segment(kind: &str, path_key: &str, value: &str) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(kind.as_bytes());
    out.push(0);
    out.extend_from_slice(path_key.as_bytes());
    out.push(0);
    out.extend_from_slice(value.as_bytes());
    out
}

pub fn keccak256(input: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(input);
    hasher.finalize().into()
}

fn generate_blob_v3_keystream(
    enc_key: &[u8; 32],
    nonce: &[u8],
    path_context: &[u8],
    length: usize,
) -> Vec<u8> {
    let mut out = Vec::with_capacity(length);
    let prefixed_enc_key = length_prefixed(enc_key);
    let prefixed_nonce = length_prefixed(nonce);
    let prefixed_path_context = length_prefixed(path_context);
    let mut counter = 0_u32;

    while out.len() < length {
        let block = keccak256_many(&[
            V3_STREAM_INFO_LABEL.as_bytes(),
            &prefixed_enc_key,
            &prefixed_nonce,
            &counter.to_be_bytes(),
            &prefixed_path_context,
        ]);
        let remaining = length - out.len();
        out.extend_from_slice(&block[..remaining.min(block.len())]);
        counter = counter.wrapping_add(1);
    }

    out
}

fn compute_blob_v3_tag(
    mac_key: &[u8; 32],
    header: &[u8],
    nonce: &[u8],
    path_context: &[u8],
    ciphertext: &[u8],
) -> [u8; BLOB_V3_TAG_LENGTH] {
    let full = hmac_keccak256(
        mac_key,
        &[
            V3_TAG_INFO_LABEL.as_bytes(),
            &length_prefixed(header),
            &length_prefixed(nonce),
            &length_prefixed(path_context),
            &(ciphertext.len() as u64).to_be_bytes(),
            ciphertext,
        ],
    );
    full[..BLOB_V3_TAG_LENGTH]
        .try_into()
        .expect("tag length is fixed")
}

fn hmac_keccak256(key: &[u8], parts: &[&[u8]]) -> [u8; 32] {
    let normalized_key = if key.len() > KECCAK_HMAC_BLOCK_SIZE {
        keccak256(key).to_vec()
    } else {
        key.to_vec()
    };
    let mut key_block = [0_u8; KECCAK_HMAC_BLOCK_SIZE];
    key_block[..normalized_key.len()].copy_from_slice(&normalized_key);

    let mut ipad = [0_u8; KECCAK_HMAC_BLOCK_SIZE];
    let mut opad = [0_u8; KECCAK_HMAC_BLOCK_SIZE];
    for index in 0..KECCAK_HMAC_BLOCK_SIZE {
        ipad[index] = key_block[index] ^ 0x36;
        opad[index] = key_block[index] ^ 0x5c;
    }

    let mut inner_input = Vec::new();
    inner_input.extend_from_slice(&ipad);
    for part in parts {
        inner_input.extend_from_slice(part);
    }
    let inner = keccak256(&inner_input);

    let mut outer_input = Vec::new();
    outer_input.extend_from_slice(&opad);
    outer_input.extend_from_slice(&inner);
    keccak256(&outer_input)
}

fn keccak256_many(parts: &[&[u8]]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    for part in parts {
        hasher.update(part);
    }
    hasher.finalize().into()
}

fn length_prefixed(bytes: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(4 + bytes.len());
    out.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    out.extend_from_slice(bytes);
    out
}

fn blob_v3_header() -> [u8; 4] {
    [
        BLOB_V2_MAGIC[0],
        BLOB_V2_MAGIC[1],
        BLOB_V2_MAGIC[2],
        BLOB_V3_VERSION,
    ]
}

fn constant_time_equal(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right.iter())
        .fold(0_u8, |diff, (left, right)| diff | (left ^ right))
        == 0
}

fn blob_to_bytes(blob: &str) -> Option<Vec<u8>> {
    if let Some(value) = blob.strip_prefix(BLOB_BASE64URL_PREFIX) {
        return base64_url_decode(value);
    }
    let clean = blob.strip_prefix("0x").unwrap_or(blob);
    hex_decode(clean)
}

fn base64_url_encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::new();
    let mut index = 0;
    while index < bytes.len() {
        let first = bytes[index];
        let second = bytes.get(index + 1).copied();
        let third = bytes.get(index + 2).copied();

        out.push(ALPHABET[(first >> 2) as usize] as char);
        out.push(
            ALPHABET[(((first & 0b0000_0011) << 4) | second.unwrap_or(0) >> 4) as usize] as char,
        );
        if let Some(second) = second {
            out.push(
                ALPHABET[(((second & 0b0000_1111) << 2) | third.unwrap_or(0) >> 6) as usize]
                    as char,
            );
        }
        if let Some(third) = third {
            out.push(ALPHABET[(third & 0b0011_1111) as usize] as char);
        }

        index += 3;
    }
    out
}

fn base64_url_decode(input: &str) -> Option<Vec<u8>> {
    let mut values = Vec::new();
    for byte in input.bytes() {
        let value = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'-' => 62,
            b'_' => 63,
            b'=' => continue,
            _ => return None,
        };
        values.push(value);
    }

    let mut out = Vec::new();
    for chunk in values.chunks(4) {
        if chunk.len() == 1 {
            return None;
        }
        let first = chunk[0];
        let second = chunk[1];
        out.push((first << 2) | (second >> 4));
        if chunk.len() > 2 {
            let third = chunk[2];
            out.push(((second & 0b0000_1111) << 4) | (third >> 2));
            if chunk.len() > 3 {
                let fourth = chunk[3];
                out.push(((third & 0b0000_0011) << 6) | fourth);
            }
        }
    }
    Some(out)
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
