use std::collections::BTreeMap;

use this_me::kernel::{Kernel, ParsedPath, Value};

fn object(entries: impl IntoIterator<Item = (&'static str, Value)>) -> Value {
    Value::Object(
        entries
            .into_iter()
            .map(|(key, value)| (key.to_string(), value))
            .collect::<BTreeMap<_, _>>(),
    )
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut me = Kernel::new();

    me.postulate("apps.demo.notes[alpha].title", "Alpha")?;
    me.postulate("apps.demo.notes[beta].title", "Beta")?;
    me.postulate("apps.demo.notes[beta].tags.primary", "work")?;

    assert_eq!(
        me.children("apps.demo.notes[]")?,
        vec!["alpha".to_string(), "beta".to_string()]
    );

    assert_eq!(
        me.read_public_subtree("apps.demo.notes[]")?,
        Some(object([
            ("alpha", object([("title", Value::from("Alpha"))])),
            (
                "beta",
                object([
                    ("tags", object([("primary", Value::from("work"))])),
                    ("title", Value::from("Beta")),
                ]),
            ),
        ]))
    );

    let parsed = ParsedPath::parse("apps.demo.notes[priority >= 2]")?;
    assert_eq!(
        parsed.normalized(),
        vec![
            "apps".to_string(),
            "demo".to_string(),
            "notes".to_string(),
            "priority >= 2".to_string(),
        ]
    );

    println!("notes[] members = {:?}", me.children("apps.demo.notes[]")?);
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    run()
}

#[test]
fn example_runs() {
    run().unwrap();
}
