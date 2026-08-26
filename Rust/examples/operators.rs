use this_me::kernel::{Kernel, Value};

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut me = Kernel::new();

    me.claim_identity("Jabellae")?;
    assert_eq!(me.active_identity(), Some("jabellae"));

    me.postulate("wallet.income", 100_u64)?;
    me.postulate("wallet.expenses", 40_u64)?;
    me.derive("wallet", "total", "income - expenses")?;
    assert_eq!(me.read("wallet.total"), Some(&Value::from(60_f64)));

    me.pointer("profile.wallet", "wallet")?;
    assert_eq!(me.read("profile.wallet.total"), Some(&Value::from(60_f64)));

    me.query(
        "profile.summary",
        ["profile.wallet.total", "profile.missing"],
    )?;
    assert_eq!(
        me.read("profile.summary"),
        Some(&Value::Array(vec![Value::from(60_f64), Value::Null]))
    );

    me.secret("wallet.hidden", "owner-secret")?;
    me.postulate("wallet.hidden.note", "private")?;
    assert_eq!(me.read("wallet.hidden.note"), Some(&Value::from("private")));
    assert_eq!(me.read_public("wallet.hidden.note"), None);

    me.remove("wallet.expenses")?;
    assert_eq!(me.read("wallet.expenses"), None);

    println!("operator memories = {}", me.memories().len());
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    run()
}

#[test]
fn example_runs() {
    run().unwrap();
}
