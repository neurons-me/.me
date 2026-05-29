//! host.rs
//!
//! Helper utilities to inspect the current host machine. Used by the
//! `this-me host` CLI command. The implementation keeps dependencies
//! minimal (standard library only) so it works everywhere the CLI
//! compiles.
use std::env;
use std::net::UdpSocket;
use std::process::Command;
use owo_colors::OwoColorize;
use atty;
use get_if_addrs::get_if_addrs;
/// Print a small summary about the machine running the CLI.
///
/// We keep the API result-based so callers can surface a friendly
/// error message without panicking.
pub fn print_host_summary() -> Result<(), String> {
    // Enable color on stdout if terminal supports it
    if atty::is(atty::Stream::Stdout) {
        // No manual override needed; owo_colors auto-detects support.
    }
    println!("\n{}", "======HOST INFORMATION======".bright_yellow().bold());
    let hostname = current_hostname().unwrap_or_else(|| "(unknown)".to_string());
    let primary_ip = discover_primary_ip().unwrap_or_else(|| "(unavailable)".to_string());
    println!("{} {}", "🖥️  Hostname :".bright_blue().bold(), hostname.white());
    println!("{} {}", "🌐 Primary IP :".cyan().bold(), primary_ip.white());
    println!("{} {} {}", "🧰 Platform :".magenta().bold(), env::consts::OS.white(), env::consts::ARCH.white());
    println!("{} {}", "🗓️  Rust env :".bright_cyan().bold(), env::var("RUSTUP_TOOLCHAIN").unwrap_or_else(|_| "default".into()).bright_white());
    println!("{}", "---------------------------------\n".bright_black());
    Ok(())
}

pub fn print_network_summary() -> Result<(), String> {
    println!("\n{}", "====== NETWORK INTERFACES ======".bright_yellow().bold());
    let ifaces = get_if_addrs().map_err(|e| format!("Failed to get network interfaces: {}", e))?;
    for iface in ifaces {
        let name_colored = iface.name.bright_blue();
        let ip = iface.addr.ip();
        let ip_string = ip.to_string();
        let ip_colored = ip_string.white();
        println!("🔸 {} {}", name_colored, ip_colored);
    }
    println!("{}", "---------------------------------".bright_black());
    Ok(())
}

fn current_hostname() -> Option<String> {
    // Common environment variables across platforms
    if let Ok(value) = env::var("HOSTNAME") {
        if !value.is_empty() {
            return Some(value);
        }
    }
    if cfg!(target_os = "windows") {
        if let Ok(value) = env::var("COMPUTERNAME") {
            if !value.is_empty() {
                return Some(value);
            }
        }
    }

    // Fallback: ask the OS via the `hostname` command.
    Command::new(if cfg!(target_os = "windows") { "hostname" } else { "hostname" })
        .output()
        .ok()
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn discover_primary_ip() -> Option<String> {
    // Bind to a UDP socket and connect to an external address (no packets sent).
    // This is a common trick to determine the interface used for outbound traffic.
    UdpSocket::bind(("0.0.0.0", 0))
        .ok()
        .and_then(|socket| {
            socket
                .connect(("8.8.8.8", 80))
                .ok()
                .and_then(|_| socket.local_addr().ok())
        })
        .map(|addr| addr.ip().to_string())
}
