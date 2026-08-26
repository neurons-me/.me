use std::fmt;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value as JsonValue;
use this_me::kernel::{
    execute_value_to_json, kernel_value_to_json, parse_kernel_value, proof_result_to_json,
    snapshot_to_json, ExecuteValue, Kernel, ProofInput,
};
use this_me::runtime::KernelRuntime;
use this_me::storage::JsonFileStore;

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), CliError> {
    let cli = Cli::parse(std::env::args().skip(1))?;
    if cli.command.is_empty() {
        print_help();
        return Ok(());
    }

    if matches!(
        cli.command.first().map(String::as_str),
        Some("help" | "--help" | "-h")
    ) {
        print_help();
        return Ok(());
    }

    let mut runtime = load_runtime(cli.state.as_ref())?;
    apply_identity_options(runtime.kernel_mut(), &cli)?;

    let output = match cli.command[0].as_str() {
        "read" => {
            let path = cli.required_arg(1, "read requires a path")?;
            runtime
                .read(path)
                .map(kernel_value_to_json)
                .unwrap_or(JsonValue::Null)
        }
        "write" => {
            let path = cli.required_arg(1, "write requires a path")?;
            let value = parse_kernel_value(cli.required_arg(2, "write requires a JSON value")?)?;
            runtime.write(path, value.clone())?;
            kernel_value_to_json(&value)
        }
        "exec" => {
            let target = cli.required_arg(1, "exec requires a me:// target")?;
            let body = cli
                .command
                .get(2)
                .map(|raw| parse_kernel_value(raw).map(ExecuteValue::Value))
                .transpose()?;
            let result = runtime.execute(target, body)?;
            execute_value_to_json(&result)
        }
        "inspect" => {
            let target = match cli.command.get(1) {
                Some(path) if !path.trim().is_empty() => format!("me://self:inspect/{path}"),
                _ => "me://self:inspect/".to_string(),
            };
            let result = runtime.kernel_mut().execute(target, None)?;
            execute_value_to_json(&result)
        }
        "explain" => {
            let path = cli.required_arg(1, "explain requires a path")?;
            let result = runtime
                .kernel_mut()
                .execute(format!("me://self:explain/{path}"), None)?;
            execute_value_to_json(&result)
        }
        "snapshot" => snapshot_to_json(&runtime.kernel().export_snapshot()),
        "prove" => {
            let root_namespace = cli.required_arg(1, "prove requires a root namespace")?;
            let challenge = cli.command.get(2).cloned();
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|error| CliError::new(error.to_string()))?
                .as_millis()
                .try_into()
                .map_err(|_| CliError::new("timestamp does not fit u64"))?;
            let proof = runtime.kernel().prove_with_timestamp(
                ProofInput {
                    root_namespace: root_namespace.to_string(),
                    challenge,
                },
                timestamp,
            )?;
            proof_result_to_json(&proof)
        }
        command => return Err(CliError::new(format!("unknown command: {command}"))),
    };

    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

#[derive(Debug, Default)]
struct Cli {
    state: Option<PathBuf>,
    seed: Option<String>,
    who: Option<String>,
    secret: Option<String>,
    expression: Option<String>,
    command: Vec<String>,
}

impl Cli {
    fn parse(args: impl IntoIterator<Item = String>) -> Result<Self, CliError> {
        let mut cli = Self::default();
        let mut args = args.into_iter().peekable();

        while let Some(arg) = args.next() {
            if !cli.command.is_empty() {
                cli.command.push(arg);
                continue;
            }

            match arg.as_str() {
                "--state" | "-s" => {
                    cli.state = Some(PathBuf::from(next_option_value(&mut args, "--state")?));
                }
                "--seed" => {
                    cli.seed = Some(next_option_value(&mut args, "--seed")?);
                }
                "--who" => {
                    cli.who = Some(next_option_value(&mut args, "--who")?);
                }
                "--secret" => {
                    cli.secret = Some(next_option_value(&mut args, "--secret")?);
                }
                "--expression" => {
                    cli.expression = Some(next_option_value(&mut args, "--expression")?);
                }
                _ if arg.starts_with('-') => {
                    return Err(CliError::new(format!("unknown option: {arg}")));
                }
                _ => cli.command.push(arg),
            }
        }

        Ok(cli)
    }

    fn required_arg(&self, index: usize, message: &'static str) -> Result<&str, CliError> {
        self.command
            .get(index)
            .map(String::as_str)
            .ok_or_else(|| CliError::new(message))
    }
}

fn next_option_value(
    args: &mut impl Iterator<Item = String>,
    option: &'static str,
) -> Result<String, CliError> {
    args.next()
        .ok_or_else(|| CliError::new(format!("{option} requires a value")))
}

fn load_runtime(state: Option<&PathBuf>) -> Result<KernelRuntime<Option<JsonFileStore>>, CliError> {
    KernelRuntime::load(state.map(JsonFileStore::new)).map_err(CliError::from)
}

fn apply_identity_options(kernel: &mut Kernel, cli: &Cli) -> Result<(), CliError> {
    match (&cli.who, &cli.secret) {
        (Some(who), Some(secret)) => {
            kernel.reseed_identity(who, secret);
        }
        (Some(_), None) => return Err(CliError::new("--who requires --secret")),
        (None, Some(_)) => return Err(CliError::new("--secret requires --who")),
        (None, None) => {}
    }

    if let Some(seed) = &cli.seed {
        kernel.set_seed(seed);
    }
    if let Some(expression) = &cli.expression {
        kernel.set_active_expression(Some(expression.clone()));
    }
    if cli.command.first().map(String::as_str) == Some("prove")
        && kernel.active_expression().is_none()
    {
        return Err(CliError::new(
            "prove requires --who/--secret or --expression with --seed",
        ));
    }

    Ok(())
}

fn print_help() {
    println!(
        r#".me Rust kernel

Usage:
  me [--state FILE] write <path> <json>
  me [--state FILE] read <path>
  me [--state FILE] exec <me://target> [json]
  me [--state FILE] inspect [path]
  me [--state FILE] explain <path>
  me [--state FILE] snapshot
  me --who <id> --secret <secret> prove <root-namespace> [challenge]
  me --seed <seed> --expression <id> prove <root-namespace> [challenge]
"#
    );
}

#[derive(Debug)]
struct CliError(String);

impl CliError {
    fn new(message: impl Into<String>) -> Self {
        Self(message.into())
    }
}

impl fmt::Display for CliError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for CliError {}

impl From<std::io::Error> for CliError {
    fn from(error: std::io::Error) -> Self {
        Self(error.to_string())
    }
}

impl From<serde_json::Error> for CliError {
    fn from(error: serde_json::Error) -> Self {
        Self(error.to_string())
    }
}

impl From<this_me::kernel::KernelError> for CliError {
    fn from(error: this_me::kernel::KernelError) -> Self {
        Self(error.to_string())
    }
}

impl From<this_me::kernel::ExecuteError> for CliError {
    fn from(error: this_me::kernel::ExecuteError) -> Self {
        Self(error.to_string())
    }
}

impl From<this_me::kernel::ProofError> for CliError {
    fn from(error: this_me::kernel::ProofError) -> Self {
        Self(error.to_string())
    }
}

impl From<this_me::kernel::JsonCodecError> for CliError {
    fn from(error: this_me::kernel::JsonCodecError) -> Self {
        Self(error.to_string())
    }
}

impl From<this_me::storage::StorageError> for CliError {
    fn from(error: this_me::storage::StorageError) -> Self {
        Self(error.to_string())
    }
}

impl From<this_me::runtime::RuntimeError> for CliError {
    fn from(error: this_me::runtime::RuntimeError) -> Self {
        Self(error.to_string())
    }
}
