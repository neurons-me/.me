use this_me::kernel::{Kernel, Value};

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut me = Kernel::new();

    me.postulate("profile.name", "Jabellae")?;
    me.postulate("wallet.income", 100_u64)?;
    me.postulate("wallet.expenses", 40_u64)?;
    me.derive("", "wallet.total", "wallet.income - wallet.expenses")?;

    assert_eq!(me.read("wallet.total"), Some(&Value::from(60_u64)));
    println!("wallet.total = {:?}", me.read("wallet.total"));

    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    run()
}

#[test]
fn example_runs() {
    run().unwrap();
}
