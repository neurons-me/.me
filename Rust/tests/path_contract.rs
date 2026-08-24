use this_me::kernel::{Kernel, ParsedPath, PathPart, Selector, Value};

#[test]
fn dotted_paths_parse_to_segments() {
    let path = ParsedPath::parse("apps.fulltrailer.tractos").unwrap();

    assert_eq!(
        path.parts(),
        &[
            PathPart::Segment("apps".to_string()),
            PathPart::Segment("fulltrailer".to_string()),
            PathPart::Segment("tractos".to_string()),
        ]
    );
    assert_eq!(
        path.normalized(),
        vec![
            "apps".to_string(),
            "fulltrailer".to_string(),
            "tractos".to_string(),
        ]
    );
}

#[test]
fn numeric_selector_is_a_literal_member() {
    let path = ParsedPath::parse("items[1]").unwrap();

    assert_eq!(
        path.parts(),
        &[
            PathPart::Segment("items".to_string()),
            PathPart::Selector(Selector::Literal("1".to_string())),
        ]
    );
    assert_eq!(
        path.normalized(),
        vec!["items".to_string(), "1".to_string()]
    );
}

#[test]
fn empty_selector_preserves_plural_shape() {
    let path = ParsedPath::parse("request[]").unwrap();

    assert_eq!(
        path.parts(),
        &[
            PathPart::Segment("request".to_string()),
            PathPart::Selector(Selector::EmptyPlural),
        ]
    );
    assert_eq!(path.normalized(), vec!["request".to_string()]);
}

#[test]
fn quoted_selector_can_contain_dots() {
    let path = ParsedPath::parse(r#"item["hello.world"]"#).unwrap();

    assert_eq!(
        path.parts(),
        &[
            PathPart::Segment("item".to_string()),
            PathPart::Selector(Selector::Literal("hello.world".to_string())),
        ]
    );
    assert_eq!(
        path.normalized(),
        vec!["item".to_string(), "hello.world".to_string()]
    );
}

#[test]
fn filter_selector_is_preserved_as_expression() {
    let path = ParsedPath::parse("friends[age >= 18]").unwrap();

    assert_eq!(
        path.parts(),
        &[
            PathPart::Segment("friends".to_string()),
            PathPart::Selector(Selector::Expression("age >= 18".to_string())),
        ]
    );
    assert_eq!(
        path.normalized(),
        vec!["friends".to_string(), "age >= 18".to_string()]
    );
}

#[test]
fn chained_selectors_normalize_in_order() {
    let path = ParsedPath::parse("matrix[1][2].value").unwrap();

    assert_eq!(
        path.normalized(),
        vec![
            "matrix".to_string(),
            "1".to_string(),
            "2".to_string(),
            "value".to_string(),
        ]
    );
}

#[test]
fn kernel_uses_selector_normalization_for_reads_and_writes() {
    let mut kernel = Kernel::new();

    kernel.postulate(r#"item["hello.world"]"#, "kept").unwrap();

    assert_eq!(
        kernel.read(["item", "hello.world"]),
        Some(&Value::from("kept"))
    );
    assert_eq!(
        kernel.read(r#"item["hello.world"]"#),
        Some(&Value::from("kept"))
    );
}
