use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MeCanonicalSelectorKind {
    Fanout,
    Current,
    Surface,
    Claim,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MeCanonicalSelector {
    pub kind: MeCanonicalSelectorKind,
    pub raw: String,
    pub value: String,
    pub shorthand: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MeCanonicalUri {
    pub scheme: String,
    pub raw: String,
    pub href: String,
    pub namespace: String,
    pub handle: String,
    pub space: String,
    pub selector: Option<MeCanonicalSelector>,
    pub path: Option<String>,
    pub segments: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MeHumanIdentity {
    pub raw: String,
    pub alias: String,
    pub handle: String,
    pub space: String,
    pub namespace: String,
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MeDnsProjectionFailureReason {
    InvalidHost,
    TransportOnlyHost,
    UnknownSpace,
    NotCanonicalNamespace,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MeDnsProjection {
    Space {
        raw_host: String,
        host: String,
        matched_space: String,
        prefix_labels: Vec<String>,
        space: String,
    },
    Namespace {
        raw_host: String,
        host: String,
        matched_space: String,
        prefix_labels: Vec<String>,
        handle: String,
        space: String,
        namespace: String,
        uri: String,
    },
    Invalid {
        raw_host: String,
        host: String,
        matched_space: Option<String>,
        prefix_labels: Vec<String>,
        reason: MeDnsProjectionFailureReason,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MeUriError {
    Required(&'static str),
    InvalidScheme(String),
    MissingNamespace(String),
    InvalidCanonicalNamespace(String),
    InvalidCanonicalHandle(String),
    InvalidCanonicalSpace(String),
    InvalidSpaceLabel(String),
    InvalidSelector(String),
    InvalidClaimSelector(String),
    InvalidPath(String),
    UnknownCanonicalSpace(String),
    InvalidHumanIdentity(String),
    MalformedSelector(String),
}

impl fmt::Display for MeUriError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Required(label) => write!(f, "{label} is required"),
            Self::InvalidScheme(value) => {
                write!(f, "invalid me URI \"{value}\": expected \"me://\" scheme")
            }
            Self::MissingNamespace(value) => {
                write!(f, "invalid me URI \"{value}\": missing namespace")
            }
            Self::InvalidCanonicalNamespace(value) => write!(
                f,
                "invalid canonical namespace \"{value}\": expected handle.space with a dotted space"
            ),
            Self::InvalidCanonicalHandle(value) => write!(f, "invalid canonical handle: {value}"),
            Self::InvalidCanonicalSpace(value) => write!(
                f,
                "invalid canonical space \"{value}\": expected at least two labels"
            ),
            Self::InvalidSpaceLabel(value) => write!(f, "invalid space label: {value}"),
            Self::InvalidSelector(value) => write!(f, "invalid surface selector: {value}"),
            Self::InvalidClaimSelector(value) => write!(f, "invalid claim selector token: {value}"),
            Self::InvalidPath(value) => write!(f, "invalid canonical path \"{value}\""),
            Self::UnknownCanonicalSpace(value) => write!(f, "unknown canonical space \"{value}\""),
            Self::InvalidHumanIdentity(value) => {
                write!(
                    f,
                    "invalid human identity \"{value}\": expected handle@space"
                )
            }
            Self::MalformedSelector(value) => {
                write!(f, "invalid me URI \"{value}\": malformed selector")
            }
        }
    }
}

impl std::error::Error for MeUriError {}

pub fn normalize_canonical_handle(raw_handle: &str) -> Result<String, MeUriError> {
    let handle = required(raw_handle, "Handle")?.to_ascii_lowercase();
    if !is_dns_label(&handle) {
        return Err(MeUriError::InvalidCanonicalHandle(raw_handle.to_string()));
    }
    Ok(handle)
}

pub fn normalize_canonical_space(raw_space: &str) -> Result<String, MeUriError> {
    let normalized = normalize_hostish_value(required(raw_space, "Space")?);
    let labels = split_labels(&normalized);
    if labels.len() < 2 {
        return Err(MeUriError::InvalidCanonicalSpace(raw_space.to_string()));
    }
    for label in &labels {
        if !is_dns_label(label) {
            return Err(MeUriError::InvalidSpaceLabel(raw_space.to_string()));
        }
    }
    Ok(labels.join("."))
}

pub fn format_canonical_me_uri(
    handle: &str,
    space: &str,
    selector: Option<&str>,
    path: Option<&str>,
) -> Result<String, MeUriError> {
    let handle = normalize_canonical_handle(handle)?;
    let space = normalize_canonical_space(space)?;
    let selector = serialize_selector(selector)?;
    let path = match path {
        Some(raw_path) if !raw_path.trim().is_empty() => {
            format!("/{}", parse_canonical_path(raw_path)?.0)
        }
        _ => String::new(),
    };
    Ok(format!("me://{handle}.{space}{selector}{path}"))
}

pub fn parse_me_uri(raw_input: &str) -> Result<MeCanonicalUri, MeUriError> {
    let raw = required(raw_input, "me:// URI")?.to_string();
    if !raw.to_ascii_lowercase().starts_with("me://") {
        return Err(MeUriError::InvalidScheme(raw_input.to_string()));
    }

    let without_scheme = &raw[5..];
    if without_scheme.trim().is_empty() {
        return Err(MeUriError::MissingNamespace(raw_input.to_string()));
    }

    let slash_index = without_scheme.find('/');
    let head = slash_index
        .map(|index| &without_scheme[..index])
        .unwrap_or(without_scheme)
        .trim();
    let path_part = slash_index
        .map(|index| &without_scheme[index + 1..])
        .unwrap_or("");

    let mut namespace_part = head;
    let mut selector_part = None;
    if let Some(open_index) = head.find('[') {
        let close_index = head.rfind(']');
        if close_index.is_none_or(|index| index < open_index || index != head.len() - 1) {
            return Err(MeUriError::MalformedSelector(raw_input.to_string()));
        }
        let close_index = close_index.expect("checked above");
        namespace_part = head[..open_index].trim();
        selector_part = Some(head[open_index + 1..close_index].trim());
    }

    let namespace = parse_canonical_namespace(namespace_part)?;
    let selector = parse_canonical_selector(selector_part)?;
    let path = if slash_index.is_some() {
        Some(parse_canonical_path(path_part)?)
    } else {
        None
    };
    let href = format_canonical_me_uri(
        &namespace.handle,
        &namespace.space,
        selector.as_ref().map(|selector| selector.raw.as_str()),
        path.as_ref().map(|path| path.0.as_str()),
    )?;

    Ok(MeCanonicalUri {
        scheme: "me".to_string(),
        raw,
        href,
        namespace: namespace.value,
        handle: namespace.handle,
        space: namespace.space,
        selector,
        path: path.as_ref().map(|path| path.0.clone()),
        segments: path.map(|path| path.1).unwrap_or_default(),
    })
}

pub fn try_parse_me_uri(raw_input: &str) -> Option<MeCanonicalUri> {
    parse_me_uri(raw_input).ok()
}

pub fn parse_canonical_me_uri(
    raw_input: &str,
    known_spaces: &[&str],
) -> Result<MeCanonicalUri, MeUriError> {
    let parsed = parse_me_uri(raw_input)?;
    let known_spaces = normalize_known_spaces(known_spaces)?;
    if !known_spaces.is_empty() && !known_spaces.contains(&parsed.space) {
        return Err(MeUriError::UnknownCanonicalSpace(parsed.space));
    }
    Ok(parsed)
}

pub fn canonicalize_human_identity(
    raw_input: &str,
    known_spaces: &[&str],
) -> Result<MeHumanIdentity, MeUriError> {
    let raw = required(raw_input, "Human identity")?.to_string();
    let mut parts = raw.split('@');
    let handle_part = parts.next();
    let space_part = parts.next();
    if handle_part.is_none() || space_part.is_none() || parts.next().is_some() {
        return Err(MeUriError::InvalidHumanIdentity(raw_input.to_string()));
    }

    let handle = normalize_canonical_handle(handle_part.expect("checked above"))?;
    let space = normalize_canonical_space(space_part.expect("checked above"))?;
    let uri = format_canonical_me_uri(&handle, &space, None, None)?;
    parse_canonical_me_uri(&uri, known_spaces)?;
    let namespace = format!("{handle}.{space}");

    Ok(MeHumanIdentity {
        raw,
        alias: format!("{handle}@{space}"),
        handle,
        space,
        namespace,
        uri,
    })
}

pub fn canonicalize_legacy_at_operator(raw_input: &str, known_spaces: &[&str]) -> Option<String> {
    let raw = raw_input.trim();
    if !raw.contains('@') {
        return None;
    }
    canonicalize_human_identity(raw, known_spaces)
        .ok()
        .map(|identity| identity.uri)
}

pub fn project_dns_host_to_namespace(raw_host: &str, known_spaces: &[&str]) -> MeDnsProjection {
    let host = normalize_hostish_value(raw_host);
    if host.is_empty() {
        return MeDnsProjection::Invalid {
            raw_host: raw_host.to_string(),
            host,
            matched_space: None,
            prefix_labels: Vec::new(),
            reason: MeDnsProjectionFailureReason::InvalidHost,
        };
    }

    if host == "localhost" || host.ends_with(".local") {
        return MeDnsProjection::Invalid {
            raw_host: raw_host.to_string(),
            host,
            matched_space: None,
            prefix_labels: Vec::new(),
            reason: MeDnsProjectionFailureReason::TransportOnlyHost,
        };
    }

    let known_spaces = normalize_known_spaces(known_spaces).unwrap_or_default();
    let Some(matched_space) = find_longest_known_space_suffix(&host, &known_spaces) else {
        return MeDnsProjection::Invalid {
            raw_host: raw_host.to_string(),
            host,
            matched_space: None,
            prefix_labels: Vec::new(),
            reason: MeDnsProjectionFailureReason::UnknownSpace,
        };
    };

    if host == matched_space {
        return MeDnsProjection::Space {
            raw_host: raw_host.to_string(),
            host,
            matched_space: matched_space.clone(),
            prefix_labels: Vec::new(),
            space: matched_space,
        };
    }

    let prefix = host
        .strip_suffix(&format!(".{matched_space}"))
        .unwrap_or("")
        .to_string();
    let prefix_labels = split_labels(&prefix);
    if prefix_labels.len() != 1 || !is_dns_label(&prefix_labels[0]) {
        return MeDnsProjection::Invalid {
            raw_host: raw_host.to_string(),
            host,
            matched_space: Some(matched_space),
            prefix_labels,
            reason: MeDnsProjectionFailureReason::NotCanonicalNamespace,
        };
    }

    let handle = prefix_labels[0].clone();
    let namespace = format!("{handle}.{matched_space}");
    let uri = format_canonical_me_uri(&handle, &matched_space, None, None).unwrap_or_else(|_| {
        // The matched space and handle were normalized above; this path is unreachable.
        format!("me://{namespace}")
    });

    MeDnsProjection::Namespace {
        raw_host: raw_host.to_string(),
        host,
        matched_space: matched_space.clone(),
        prefix_labels,
        handle,
        space: matched_space,
        namespace,
        uri,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct MeCanonicalNamespace {
    handle: String,
    space: String,
    value: String,
}

fn parse_canonical_namespace(raw_namespace: &str) -> Result<MeCanonicalNamespace, MeUriError> {
    let namespace = required(raw_namespace, "Canonical namespace")?
        .trim_start_matches("me://")
        .trim()
        .to_ascii_lowercase();
    let labels = split_labels(&namespace);
    if labels.len() < 3 {
        return Err(MeUriError::InvalidCanonicalNamespace(
            raw_namespace.to_string(),
        ));
    }
    let handle = normalize_canonical_handle(&labels[0])?;
    let space = normalize_canonical_space(&labels[1..].join("."))?;
    let value = format!("{handle}.{space}");
    Ok(MeCanonicalNamespace {
        handle,
        space,
        value,
    })
}

fn parse_canonical_selector(
    raw_selector: Option<&str>,
) -> Result<Option<MeCanonicalSelector>, MeUriError> {
    let Some(raw_selector) = raw_selector else {
        return Ok(None);
    };
    let value = raw_selector.trim();

    if value.is_empty() {
        return Ok(Some(MeCanonicalSelector {
            kind: MeCanonicalSelectorKind::Fanout,
            raw: value.to_string(),
            value: value.to_string(),
            shorthand: false,
        }));
    }

    if value == "current" {
        return Ok(Some(MeCanonicalSelector {
            kind: MeCanonicalSelectorKind::Current,
            raw: value.to_string(),
            value: value.to_string(),
            shorthand: false,
        }));
    }

    if let Some(token) = value.strip_prefix("claim:") {
        if !is_surface_token(token) {
            return Err(MeUriError::InvalidClaimSelector(value.to_string()));
        }
        return Ok(Some(MeCanonicalSelector {
            kind: MeCanonicalSelectorKind::Claim,
            raw: value.to_string(),
            value: format!("claim:{token}"),
            shorthand: false,
        }));
    }

    let shorthand = !value.starts_with("surface:");
    let surface_name = if shorthand {
        value
    } else {
        &value["surface:".len()..]
    };
    if !is_surface_token(surface_name) {
        return Err(MeUriError::InvalidSelector(value.to_string()));
    }

    Ok(Some(MeCanonicalSelector {
        kind: MeCanonicalSelectorKind::Surface,
        raw: value.to_string(),
        value: format!("surface:{surface_name}"),
        shorthand,
    }))
}

fn parse_canonical_path(raw_path: &str) -> Result<(String, Vec<String>), MeUriError> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err(MeUriError::InvalidPath(raw_path.to_string()));
    }
    if trimmed.contains('/') {
        return Err(MeUriError::InvalidPath(raw_path.to_string()));
    }

    let segments = trimmed
        .split('.')
        .map(str::trim)
        .map(str::to_string)
        .collect::<Vec<_>>();
    if segments.iter().any(|segment| segment.is_empty()) {
        return Err(MeUriError::InvalidPath(raw_path.to_string()));
    }
    if segments.iter().any(|segment| !is_path_segment(segment)) {
        return Err(MeUriError::InvalidPath(raw_path.to_string()));
    }

    Ok((segments.join("."), segments))
}

fn serialize_selector(selector: Option<&str>) -> Result<String, MeUriError> {
    let Some(selector) = selector else {
        return Ok(String::new());
    };
    let Some(parsed) = parse_canonical_selector(Some(selector))? else {
        return Ok(String::new());
    };
    Ok(format!("[{}]", parsed.value))
}

fn normalize_known_spaces(known_spaces: &[&str]) -> Result<Vec<String>, MeUriError> {
    let mut unique = Vec::<String>::new();
    for raw_space in known_spaces {
        let space = normalize_canonical_space(raw_space)?;
        if !unique.contains(&space) {
            unique.push(space);
        }
    }
    unique.sort_by(|left, right| {
        right
            .split('.')
            .count()
            .cmp(&left.split('.').count())
            .then_with(|| right.len().cmp(&left.len()))
    });
    Ok(unique)
}

fn find_longest_known_space_suffix(host: &str, known_spaces: &[String]) -> Option<String> {
    for known_space in known_spaces {
        if host == known_space || host.ends_with(&format!(".{known_space}")) {
            return Some(known_space.clone());
        }
    }
    None
}

fn normalize_hostish_value(raw_value: &str) -> String {
    let mut value = raw_value.trim().to_string();
    if value.is_empty() {
        return value;
    }

    if let Some(scheme_index) = value.find("://") {
        value = value[scheme_index + 3..].to_string();
    }
    for delimiter in ['/', '?', '#'] {
        if let Some(index) = value.find(delimiter) {
            value.truncate(index);
        }
    }
    if let Some(colon_index) = value.rfind(':') {
        if value[colon_index + 1..]
            .chars()
            .all(|ch| ch.is_ascii_digit())
        {
            value.truncate(colon_index);
        }
    }

    value.trim_end_matches('.').trim().to_ascii_lowercase()
}

fn required<'a>(value: &'a str, label: &'static str) -> Result<&'a str, MeUriError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(MeUriError::Required(label));
    }
    Ok(trimmed)
}

fn split_labels(value: &str) -> Vec<String> {
    value
        .split('.')
        .map(str::trim)
        .filter(|label| !label.is_empty())
        .map(str::to_string)
        .collect()
}

fn is_dns_label(value: &str) -> bool {
    let len = value.len();
    if len == 0 || len > 63 {
        return false;
    }
    let bytes = value.as_bytes();
    if bytes[0] == b'-' || bytes[len - 1] == b'-' {
        return false;
    }
    value
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
}

fn is_surface_token(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
}

fn is_path_segment(value: &str) -> bool {
    is_surface_token(value)
}
