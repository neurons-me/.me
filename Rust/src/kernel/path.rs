use std::fmt;

pub type Path = Vec<String>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedPath {
    parts: Vec<PathPart>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathPart {
    Segment(String),
    Selector(Selector),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Selector {
    EmptyPlural,
    Literal(String),
    Expression(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathParseError {
    Empty,
    EmptySegment,
    UnclosedSelector,
    UnterminatedQuote,
}

impl fmt::Display for PathParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Empty => write!(f, "path cannot be empty"),
            Self::EmptySegment => write!(f, "path segment cannot be empty"),
            Self::UnclosedSelector => write!(f, "selector is missing a closing bracket"),
            Self::UnterminatedQuote => write!(f, "selector quote is not terminated"),
        }
    }
}

impl std::error::Error for PathParseError {}

impl ParsedPath {
    pub fn parse(input: &str) -> Result<Self, PathParseError> {
        let input = input.trim();
        if input.is_empty() {
            return Err(PathParseError::Empty);
        }

        let mut parts = Vec::new();
        let mut segment = String::new();
        let mut last_was_dot = true;
        let mut i = 0;

        while i < input.len() {
            let ch = next_char(input, i);
            match ch {
                '.' => {
                    if segment.trim().is_empty() {
                        if last_was_dot {
                            return Err(PathParseError::EmptySegment);
                        }
                    } else {
                        flush_segment(&mut parts, &mut segment)?;
                    }
                    last_was_dot = true;
                    i += ch.len_utf8();
                }
                '[' => {
                    if !segment.trim().is_empty() {
                        flush_segment(&mut parts, &mut segment)?;
                    }
                    let (selector, next) = parse_selector(input, i + ch.len_utf8())?;
                    parts.push(PathPart::Selector(selector));
                    last_was_dot = false;
                    i = next;
                }
                _ => {
                    segment.push(ch);
                    last_was_dot = false;
                    i += ch.len_utf8();
                }
            }
        }

        if !segment.trim().is_empty() {
            flush_segment(&mut parts, &mut segment)?;
        } else if last_was_dot {
            return Err(PathParseError::EmptySegment);
        }

        if parts.is_empty() {
            return Err(PathParseError::Empty);
        }

        Ok(Self { parts })
    }

    pub fn parts(&self) -> &[PathPart] {
        &self.parts
    }

    pub fn normalized(&self) -> Path {
        let mut out = Vec::new();
        for part in &self.parts {
            match part {
                PathPart::Segment(segment) => out.push(segment.clone()),
                PathPart::Selector(Selector::EmptyPlural) => {}
                PathPart::Selector(Selector::Literal(value))
                | PathPart::Selector(Selector::Expression(value)) => out.push(value.clone()),
            }
        }
        out
    }
}

pub trait IntoPath {
    fn into_path(self) -> Result<Path, PathParseError>;
}

impl IntoPath for Path {
    fn into_path(self) -> Result<Path, PathParseError> {
        Ok(self)
    }
}

impl IntoPath for &[&str] {
    fn into_path(self) -> Result<Path, PathParseError> {
        Ok(self.iter().map(|segment| (*segment).to_string()).collect())
    }
}

impl<const N: usize> IntoPath for [&str; N] {
    fn into_path(self) -> Result<Path, PathParseError> {
        Ok(self.into_iter().map(str::to_string).collect())
    }
}

impl IntoPath for &str {
    fn into_path(self) -> Result<Path, PathParseError> {
        if self.trim().is_empty() {
            return Ok(Vec::new());
        }
        ParsedPath::parse(self).map(|path| path.normalized())
    }
}

impl IntoPath for String {
    fn into_path(self) -> Result<Path, PathParseError> {
        self.as_str().into_path()
    }
}

fn flush_segment(parts: &mut Vec<PathPart>, segment: &mut String) -> Result<(), PathParseError> {
    let segment = std::mem::take(segment).trim().to_string();
    if segment.is_empty() {
        return Err(PathParseError::EmptySegment);
    }
    parts.push(PathPart::Segment(segment));
    Ok(())
}

fn parse_selector(input: &str, start: usize) -> Result<(Selector, usize), PathParseError> {
    let mut raw = String::new();
    let mut quote = None;
    let mut escaped = false;
    let mut i = start;

    while i < input.len() {
        let ch = next_char(input, i);
        if escaped {
            raw.push(ch);
            escaped = false;
            i += ch.len_utf8();
            continue;
        }

        if let Some(expected_quote) = quote {
            if ch == '\\' {
                raw.push(ch);
                escaped = true;
            } else {
                if ch == expected_quote {
                    quote = None;
                }
                raw.push(ch);
            }
            i += ch.len_utf8();
            continue;
        }

        match ch {
            '"' | '\'' => {
                quote = Some(ch);
                raw.push(ch);
                i += ch.len_utf8();
            }
            ']' => {
                if quote.is_some() {
                    return Err(PathParseError::UnterminatedQuote);
                }
                return Ok((classify_selector(&raw)?, i + ch.len_utf8()));
            }
            _ => {
                raw.push(ch);
                i += ch.len_utf8();
            }
        }
    }

    if quote.is_some() {
        return Err(PathParseError::UnterminatedQuote);
    }
    Err(PathParseError::UnclosedSelector)
}

fn classify_selector(raw: &str) -> Result<Selector, PathParseError> {
    let selector = raw.trim();
    if selector.is_empty() {
        return Ok(Selector::EmptyPlural);
    }

    if is_quoted(selector) {
        return Ok(Selector::Literal(unquote(selector)?));
    }

    if looks_like_expression(selector) {
        return Ok(Selector::Expression(selector.to_string()));
    }

    Ok(Selector::Literal(selector.to_string()))
}

fn is_quoted(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    let Some(last) = value.chars().last() else {
        return false;
    };
    (first == '"' || first == '\'') && first == last && value.len() >= 2
}

fn unquote(value: &str) -> Result<String, PathParseError> {
    let mut chars = value.chars();
    let quote = chars.next().ok_or(PathParseError::UnterminatedQuote)?;
    let mut out = String::new();
    let mut escaped = false;

    for ch in chars.take(value.chars().count().saturating_sub(2)) {
        if escaped {
            out.push(ch);
            escaped = false;
            continue;
        }
        if ch == '\\' {
            escaped = true;
        } else {
            out.push(ch);
        }
    }

    if escaped {
        out.push('\\');
    }

    if !value.ends_with(quote) {
        return Err(PathParseError::UnterminatedQuote);
    }

    Ok(out)
}

fn looks_like_expression(selector: &str) -> bool {
    selector.contains("=>")
        || selector.contains("&&")
        || selector.contains("||")
        || selector.contains(">=")
        || selector.contains("<=")
        || selector.contains("==")
        || selector.contains("!=")
        || selector.contains('>')
        || selector.contains('<')
        || selector.contains("..")
}

fn next_char(input: &str, index: usize) -> char {
    input[index..]
        .chars()
        .next()
        .expect("index must point at a valid character")
}
