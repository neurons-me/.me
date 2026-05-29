
use std::io;

pub fn validate_username(username: &str) -> io::Result<()> {
    println!("🔍 Validating username: '{}' (chars: {}, bytes: {})", username, username.chars().count(), username.len());

    let username_len = username.len();
    if username_len < 5 || username_len > 21 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "❌ Username must be 5-21 characters long."));
    }

    if username.starts_with('.') || username.starts_with('_') {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "❌ Username cannot start with '.' or '_'"));
    }

    if username.ends_with('.') || username.ends_with('_') {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "❌ Username cannot end with '.' or '_'"));
    }

    if username.contains("..") || username.contains("__") || username.contains("._") || username.contains("_.") {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "❌ Username cannot contain consecutive '.' or '_'"));
    }

    if !username.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_') {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "❌ Username must only contain letters, numbers, '.' or '_'"));
    }

    let period_count = username.matches('.').count();
    if period_count > 2 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "❌ Username cannot have more than 2 periods."));
    }

    Ok(())
}
pub fn validate_password(password: &str) -> io::Result<()> {
    if password.len() < 4 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "❌ Password must be at least 4 characters long."));
    }
    Ok(())
}