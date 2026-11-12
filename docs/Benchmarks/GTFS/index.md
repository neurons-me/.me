---
layout: gui-doc
title: ".me — GTFS benchmarks"
description: "The .me kernel on GTFS public-transport feeds: what GTFS is and which datasets are measured."
image: https://suign.github.io/assets/imgs/MADRID-GTFS-DATA-me.jpg
mepath:
  - text: Benchmarks
    url: https://neurons-me.github.io/.me/docs/Benchmarks/
crumb: GTFS
view_content_name: "Doc - .me — GTFS benchmarks"
view_content_category: "Docs"
---

# GTFS

GTFS (General Transit Feed Specification) is the open format transit agencies use to publish their schedules: a set of linked CSV tables (agencies, routes, trips, stops, stop times, calendars) joined by keys. A trip belongs to a route, a stop time belongs to a trip and a stop. That makes a feed a natural dependency graph, and a good test for an engine that recomputes only what a change touches.

Each dataset below is loaded into `.me` as paths, with derived values (counts, totals) defined over the key relations. Then real update archives are replayed as writes, and every write records how many derived values it recomputed (k) and how long it took.

## Datasets

{% comment %}
To add a city: create docs/Benchmarks/GTFS/<City>/index.md (copy Madrid/index.md: layout gui-doc, mepath Benchmarks / GTFS with links, crumb <City>, one "## n. ... {#anchor}" section per run with its script, command and results folder, plus the machine line), then add one <a class="card"> for it inside the doc-cards div below, add its URL to the site search index (neurons-me.github.io docs/index.json) and regenerate sitemap.xml.
{% endcomment %}

<div class="doc-cards" markdown="0">
<a class="card" href="Madrid/"><img src="https://suign.github.io/assets/imgs/MADRID-GRAPH-ME.jpg" alt="Madrid GTFS"><span class="card-kind">Dataset · 4.2.0</span><span class="card-title">Madrid</span><span class="card-desc">GTFS-Madrid-Bench (Madrid metro, scaled with VIG): affected set k as the data grows, fan-out skew, DELETE cost, the 4.2 [] aggregate.</span></a>
</div>
