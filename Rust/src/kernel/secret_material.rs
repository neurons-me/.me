use sha3::{Digest, Keccak256};

const KECCAK_HMAC_BLOCK_SIZE: usize = 136;
const V3_KDF_LABEL: &str = "this.me/blob/v3/kdf";
const V3_ENC_INFO_LABEL: &str = "this.me/blob/v3/enc";
const V3_MAC_INFO_LABEL: &str = "this.me/blob/v3/mac";

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

fn length_prefixed(bytes: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(4 + bytes.len());
    out.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    out.extend_from_slice(bytes);
    out
}
