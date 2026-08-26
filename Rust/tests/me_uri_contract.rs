use this_me::me_uri::{
    canonicalize_human_identity, canonicalize_legacy_at_operator, parse_canonical_me_uri,
    project_dns_host_to_namespace, try_parse_me_uri, MeCanonicalSelectorKind, MeDnsProjection,
    MeDnsProjectionFailureReason,
};

#[test]
fn parses_canonical_me_uri_with_surface_selector() {
    let parsed = parse_canonical_me_uri(
        "me://suign.neurons.me[macbook]/profile.name",
        &["neurons.me"],
    )
    .unwrap();

    assert_eq!(parsed.handle, "suign");
    assert_eq!(parsed.space, "neurons.me");
    assert_eq!(
        parsed.selector.as_ref().map(|selector| &selector.kind),
        Some(&MeCanonicalSelectorKind::Surface)
    );
    assert_eq!(
        parsed
            .selector
            .as_ref()
            .map(|selector| selector.value.as_str()),
        Some("surface:macbook")
    );
    assert_eq!(parsed.path.as_deref(), Some("profile.name"));
    assert_eq!(
        parsed.href,
        "me://suign.neurons.me[surface:macbook]/profile.name"
    );
}

#[test]
fn parses_fanout_selector_without_changing_href() {
    let fanout =
        parse_canonical_me_uri("me://suign.neurons.me[]/chat.general", &["neurons.me"]).unwrap();

    assert_eq!(
        fanout.selector.as_ref().map(|selector| &selector.kind),
        Some(&MeCanonicalSelectorKind::Fanout)
    );
    assert_eq!(fanout.href, "me://suign.neurons.me[]/chat.general");
}

#[test]
fn rejects_invalid_or_unknown_canonical_namespaces() {
    assert!(try_parse_me_uri("me://neurons.me").is_none());
    assert!(format!(
        "{}",
        parse_canonical_me_uri("me://neurons.me", &[]).unwrap_err()
    )
    .contains("handle.space"));
    assert!(format!(
        "{}",
        parse_canonical_me_uri("me://sui_gn.neurons.me", &[]).unwrap_err()
    )
    .contains("canonical handle"));
    assert!(format!(
        "{}",
        parse_canonical_me_uri("me://john.dev.neurons.me", &["neurons.me"]).unwrap_err()
    )
    .to_ascii_lowercase()
    .contains("unknown canonical space"));
}

#[test]
fn honors_longest_known_space_suffix() {
    let sub_space = parse_canonical_me_uri(
        "me://john.dev.neurons.me",
        &["neurons.me", "dev.neurons.me"],
    )
    .unwrap();

    assert_eq!(sub_space.space, "dev.neurons.me");
    assert_eq!(sub_space.namespace, "john.dev.neurons.me");
}

#[test]
fn canonicalizes_human_identity_and_legacy_at_operator() {
    let human = canonicalize_human_identity("SuiGn@Neurons.me", &["neurons.me"]).unwrap();

    assert_eq!(human.alias, "suign@neurons.me");
    assert_eq!(human.namespace, "suign.neurons.me");
    assert_eq!(human.uri, "me://suign.neurons.me");

    assert_eq!(
        canonicalize_legacy_at_operator("suign@neurons.me", &["neurons.me"]),
        Some("me://suign.neurons.me".to_string())
    );
    assert_eq!(
        canonicalize_legacy_at_operator("alice@community.neurons.me", &["neurons.me"]),
        None
    );
    assert_eq!(
        canonicalize_legacy_at_operator("sui_gn@neurons.me", &["neurons.me"]),
        None
    );
}

#[test]
fn projects_dns_hosts_to_canonical_namespaces() {
    let root_projection = project_dns_host_to_namespace("https://neurons.me", &["neurons.me"]);
    assert!(matches!(
        root_projection,
        MeDnsProjection::Space {
            ref space,
            ..
        } if space == "neurons.me"
    ));

    let namespace_projection =
        project_dns_host_to_namespace("https://suign.neurons.me", &["neurons.me"]);
    assert!(matches!(
        namespace_projection,
        MeDnsProjection::Namespace {
            ref namespace,
            ref uri,
            ..
        } if namespace == "suign.neurons.me" && uri == "me://suign.neurons.me"
    ));
}

#[test]
fn rejects_noncanonical_dns_projection_shapes() {
    let multi_label_projection =
        project_dns_host_to_namespace("https://foo.bar.neurons.me", &["neurons.me"]);
    assert!(matches!(
        multi_label_projection,
        MeDnsProjection::Invalid {
            reason: MeDnsProjectionFailureReason::NotCanonicalNamespace,
            ..
        }
    ));

    let localhost_projection = project_dns_host_to_namespace("localhost", &["neurons.me"]);
    assert!(matches!(
        localhost_projection,
        MeDnsProjection::Invalid {
            reason: MeDnsProjectionFailureReason::TransportOnlyHost,
            ..
        }
    ));
}

#[test]
fn dns_projection_uses_longest_space_suffix() {
    let projection = project_dns_host_to_namespace(
        "https://user.community.neurons.me",
        &["neurons.me", "community.neurons.me"],
    );

    assert!(matches!(
        projection,
        MeDnsProjection::Namespace {
            ref space,
            ref namespace,
            ..
        } if space == "community.neurons.me" && namespace == "user.community.neurons.me"
    ));
}
