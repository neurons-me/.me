use this_me::kernel::{ExecuteValue, Kernel, RecomputeMode, Value};

#[test]
fn public_write_records_a_kernel_event() {
    let mut kernel = Kernel::new();
    kernel.postulate("profile.name", "Jabellae").unwrap();

    let events = kernel.events();
    assert_eq!(events.len(), 1);
    assert_eq!(
        events[0].path,
        vec!["profile".to_string(), "name".to_string()]
    );
    assert_eq!(events[0].operator, None);
    assert_eq!(events[0].value, Some(Value::from("Jabellae")));
    assert_eq!(events[0].memory_hash, kernel.memories()[0].hash);
}

#[test]
fn eager_derivation_records_source_and_recomputed_events_in_order() {
    let mut kernel = Kernel::new();
    kernel.postulate("order.price", 10_u64).unwrap();
    kernel.postulate("order.quantity", 2_u64).unwrap();
    kernel
        .derive("", "order.total", "order.price * order.quantity")
        .unwrap();
    kernel.clear_events();

    kernel.postulate("order.price", 15_u64).unwrap();

    let paths = kernel
        .events()
        .iter()
        .map(|event| event.path.join("."))
        .collect::<Vec<_>>();
    assert_eq!(paths, vec!["order.price", "order.total"]);
    assert_eq!(kernel.events()[1].operator.as_deref(), Some("="));
    assert_eq!(kernel.events()[1].value, Some(Value::from(30_u64)));
}

#[test]
fn lazy_derivation_records_recompute_event_only_when_read_fresh_runs() {
    let mut kernel = Kernel::new();
    kernel.postulate("order.price", 10_u64).unwrap();
    kernel.postulate("order.quantity", 2_u64).unwrap();
    kernel
        .derive("", "order.total", "order.price * order.quantity")
        .unwrap();
    kernel.set_recompute_mode(RecomputeMode::Lazy);
    kernel.clear_events();

    kernel.postulate("order.price", 15_u64).unwrap();
    assert_eq!(
        kernel
            .events()
            .iter()
            .map(|event| event.path.join("."))
            .collect::<Vec<_>>(),
        vec!["order.price"]
    );

    assert_eq!(kernel.read_fresh("order.total"), Some(Value::from(30_u64)));
    assert_eq!(
        kernel
            .events()
            .iter()
            .map(|event| event.path.join("."))
            .collect::<Vec<_>>(),
        vec!["order.price", "order.total"]
    );
}

#[test]
fn remove_records_closed_event_with_no_value() {
    let mut kernel = Kernel::new();
    kernel.postulate("profile.name", "Jabellae").unwrap();
    kernel.clear_events();

    kernel.remove("profile").unwrap();

    assert_eq!(kernel.events().len(), 1);
    assert_eq!(kernel.events()[0].path, vec!["profile".to_string()]);
    assert_eq!(kernel.events()[0].operator.as_deref(), Some("-"));
    assert_eq!(kernel.events()[0].value, None);
}

#[test]
fn events_can_be_drained_through_kernel_execute() {
    let mut kernel = Kernel::new();
    kernel.postulate("profile.name", "Jabellae").unwrap();

    let ExecuteValue::Events(events) = kernel.execute("me://kernel:drain/events", None).unwrap()
    else {
        panic!("kernel:drain/events should return events");
    };

    assert_eq!(events.len(), 1);
    assert!(kernel.events().is_empty());
    assert_eq!(
        kernel.execute("me://kernel:read/events", None).unwrap(),
        ExecuteValue::Events(Vec::new())
    );
}

#[test]
fn event_filters_match_exact_ancestor_and_descendant_paths() {
    let mut kernel = Kernel::new();
    kernel
        .postulate("apps.fulltrailer.tractos.records.0.status", "ok")
        .unwrap();
    kernel
        .postulate("apps.fulltrailer.summary", "ready")
        .unwrap();

    let exact = kernel
        .events_matching("apps.fulltrailer.tractos.records.0.status")
        .unwrap();
    assert_eq!(exact.len(), 1);
    assert_eq!(
        exact[0].path.join("."),
        "apps.fulltrailer.tractos.records.0.status"
    );

    let ancestor = kernel.events_matching("apps.fulltrailer.tractos").unwrap();
    assert_eq!(ancestor.len(), 1);
    assert_eq!(
        ancestor[0].path.join("."),
        "apps.fulltrailer.tractos.records.0.status"
    );

    let descendant = kernel
        .events_matching("apps.fulltrailer.tractos.records.0.status.label")
        .unwrap();
    assert_eq!(descendant.len(), 1);
    assert_eq!(
        descendant[0].path.join("."),
        "apps.fulltrailer.tractos.records.0.status"
    );
}

#[test]
fn filtered_drain_only_removes_matching_events() {
    let mut kernel = Kernel::new();
    kernel
        .postulate("apps.fulltrailer.home.count", 3_u64)
        .unwrap();
    kernel.postulate("apps.other.home.count", 1_u64).unwrap();

    let drained = kernel.drain_events_matching("apps.fulltrailer").unwrap();
    assert_eq!(drained.len(), 1);
    assert_eq!(drained[0].path.join("."), "apps.fulltrailer.home.count");

    assert_eq!(kernel.events().len(), 1);
    assert_eq!(kernel.events()[0].path.join("."), "apps.other.home.count");
}

#[test]
fn filtered_events_are_exposed_through_kernel_execute() {
    let mut kernel = Kernel::new();
    kernel
        .postulate("apps.fulltrailer.home.count", 3_u64)
        .unwrap();
    kernel.postulate("apps.other.home.count", 1_u64).unwrap();

    let ExecuteValue::Events(events) = kernel
        .execute("me://kernel:read/events/apps.fulltrailer", None)
        .unwrap()
    else {
        panic!("kernel:read/events/<path> should return filtered events");
    };
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].path.join("."), "apps.fulltrailer.home.count");

    let ExecuteValue::Events(drained) = kernel
        .execute("me://kernel:drain/events/apps.fulltrailer", None)
        .unwrap()
    else {
        panic!("kernel:drain/events/<path> should return filtered events");
    };
    assert_eq!(drained.len(), 1);
    assert_eq!(kernel.events().len(), 1);
    assert_eq!(kernel.events()[0].path.join("."), "apps.other.home.count");
}

#[test]
fn replay_and_hydration_do_not_reemit_runtime_events() {
    let mut kernel = Kernel::new();
    kernel.postulate("profile.name", "Jabellae").unwrap();
    let snapshot = kernel.export_snapshot();
    let memories = kernel.memories().to_vec();

    let restored = Kernel::hydrate(snapshot).unwrap();
    assert!(restored.events().is_empty());

    let mut replayed = Kernel::new();
    replayed.replay_memories(memories).unwrap();
    assert!(replayed.events().is_empty());
}
