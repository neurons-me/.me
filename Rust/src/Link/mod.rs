// src/Link/mod.rs
use colored::Colorize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

/// Guarda la ruta actual en el historial y como contexto activo
pub fn save_link(path: &str) -> Result<(), std::io::Error> {
    let history_file = "/tmp/.me_history";
    let context_file = "/tmp/.me_context";

    // Guarda en el historial
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(history_file)?;
    writeln!(file, "{}", path)?;

    // Actualiza el contexto actual
    fs::write(context_file, path)?;
    println!("{} {}", "🔗 Linking to:".bright_cyan().bold(), path);
    println!("{} '{}'", "✅ Context updated to".bright_green().bold(), path);
    Ok(())
}

/// Muestra el historial de links
pub fn show_history() {
    match fs::read_to_string("/tmp/.me_history") {
        Ok(data) => {
            println!("{}", "📜 Link history:".bright_white().bold());
            for (i, line) in data.lines().enumerate() {
                println!("{} {}", format!("{:>2}.", i + 1).bright_black(), line);
            }
        }
        Err(_) => println!("📭 No link history found."),
    }
}

/// Regresa al último contexto previo
pub fn go_back() {
    let history_file = "/tmp/.me_history";
    if let Ok(data) = fs::read_to_string(history_file) {
        let mut lines: Vec<_> = data.lines().collect();
        if lines.len() > 1 {
            lines.pop();
            if let Some(prev) = lines.last() {
                fs::write("/tmp/.me_context", prev).unwrap_or_default();
                fs::write(history_file, lines.join("\n")).unwrap_or_default();
                println!("🔙 Returned to '{}'", prev);
            }
        } else {
            println!("⚠️ No previous context.");
        }
    } else {
        println!("📭 No history file found.");
    }
}