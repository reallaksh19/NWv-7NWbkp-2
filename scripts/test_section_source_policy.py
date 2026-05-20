from section_source_policy import (
    build_section_quality,
    build_section_source_policy_report,
    get_section_feeds_map,
    load_section_source_policy,
    normalize_section_feed,
    validate_section_source_policy,
)


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def test_normalize_section_feed_list_shape():
    feed = normalize_section_feed([
        "https://example.com/rss",
        "Example News",
        "Example News",
        "A",
        "Markets",
    ])

    assert_true(feed["sourceGroup"] == "example_news", "source group should normalize")
    assert_true(feed["tier"] == "A", "tier should preserve A")
    assert_true(feed["topic"] == "markets", "topic should lowercase")


def test_section_policy_load_and_validate():
    policy = load_section_source_policy()
    validation = validate_section_source_policy(policy)

    assert_true(validation["status"] in {"PASS", "WARN"}, "policy should not fail")
    assert_true(validation["sectionCount"] >= 9, "all sections required")
    assert_true(validation["feedCount"] >= 25, "feed count should be healthy")


def test_section_feeds_map_shape():
    feeds = get_section_feeds_map()

    assert_true("topStories" in feeds, "topStories required")
    assert_true("trichy" in feeds, "trichy required")
    assert_true(all(isinstance(item, tuple) and len(item) == 3 for section in feeds.values() for item in section), "feed tuples required")


def test_build_section_quality():
    sections = {
        "topStories": [
            {"id": "a", "sourceGroup": "the_hindu", "category": "topStories"},
            {"id": "b", "sourceGroup": "ndtv", "category": "topStories"},
        ],
        "india": [],
        "tn": [],
        "trichy": [],
        "world": [],
        "business": [],
        "technology": [],
        "sports": [],
        "entertainment": [],
    }

    quality = build_section_quality(sections)

    assert_true(quality["topStories"]["storyCount"] == 2, "story count wrong")
    assert_true(quality["topStories"]["sourceGroupCount"] == 2, "source diversity wrong")
    assert_true(quality["india"]["thin"] is True, "empty section should be thin")


def test_section_source_policy_report():
    report = build_section_source_policy_report({
        "topStories": [{"id": "a", "sourceGroup": "the_hindu"}],
    }, {
        "the_hindu": {"ok": True, "items": 12, "lastSuccess": 123},
    })

    assert_true(report["reportVersion"] == "section-source-policy-report-v1", "report version missing")
    assert_true("sectionQuality" in report, "section quality missing")
    assert_true("topStories" in report["sectionSummary"], "section summary missing")


if __name__ == "__main__":
    test_normalize_section_feed_list_shape()
    test_section_policy_load_and_validate()
    test_section_feeds_map_shape()
    test_build_section_quality()
    test_section_source_policy_report()
    print("PASS: Section source policy Python tests")
