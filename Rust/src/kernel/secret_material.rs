use sha3::{Digest, Keccak256};

const V3_KDF_LABEL: &str = "this.me/blob/v3/kdf";

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

fn length_prefixed(bytes: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(4 + bytes.len());
    out.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    out.extend_from_slice(bytes);
    out
}
