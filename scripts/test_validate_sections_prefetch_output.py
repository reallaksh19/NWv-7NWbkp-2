import validate_sections_prefetch_output as gate


def make_story(index, section, source_group):
    return {
        "id": f"{section}-{index}",
        "title": f"{section} story {index}",
        "summary": "Summary",
        "url": f"https://example.com/{section}/{index}",
        "publishedAt": 1767278400000,
        "source": source_group,
        "sourceGroup": source_group,
    }


def test_validate_sections_snapshot_warns_not_fails_for_thin_pool():
    snapshot = {
        "schemaVersion": 2,
        "contentHash": "abc",
        "fetchedAt": 1767282000000,
        "sectionQuality": {
            "topStories": {"storyCount": 2, "sourceGroupCount": 2},
        },
        "sections": {
            "topStories": [
                make_story(1, "topStories", "a"),
                make_story(2, "topStories", "b"),
            ],
        },
    }

    report = gate.validate_sections_snapshot(snapshot)

    assert report["status"] == "WARN"
    assert report["storyCount"] == 2
    assert report["sectionHealth"]["topStories"]["sourceGroupCount"] == 2
    assert not report["errors"]


def test_validate_sections_snapshot_fails_structural_errors():
    report = gate.validate_sections_snapshot({
        "schemaVersion": 99,
        "contentHash": "",
        "fetchedAt": 0,
        "sections": {},
    })

    assert report["status"] == "FAIL"
    assert report["errors"]


def test_validate_sections_snapshot_passes_healthy_shape():
    sections = {}

    for section in gate.REQUIRED_SECTIONS:
        sections[section] = [
            make_story(i, section, f"source_{i % 3}")
            for i in range(6)
        ]

    snapshot = {
        "schemaVersion": 2,
        "contentHash": "hash",
        "fetchedAt": 1767282000000,
        "sectionQuality": {
            section: {"storyCount": 6, "sourceGroupCount": 3}
            for section in gate.REQUIRED_SECTIONS
        },
        "sections": sections,
    }

    report = gate.validate_sections_snapshot(snapshot)

    assert report["status"] in ("PASS", "WARN")
    assert report["sectionCount"] == len(gate.REQUIRED_SECTIONS)
    assert report["storyCount"] >= 45
    assert report["sourceGroupCount"] >= 3
    assert not report["errors"]


def test_write_summary_creates_markdown(tmp_path, monkeypatch):
    report_path = tmp_path / "sections_quality_report.json"
    summary_path = tmp_path / "sections_quality_summary.md"

    monkeypatch.setattr(gate, "REPORT_PATH", report_path)
    monkeypatch.setattr(gate, "SUMMARY_PATH", summary_path)

    report = gate.validate_sections_snapshot({
        "schemaVersion": 2,
        "contentHash": "abc",
        "fetchedAt": 1767282000000,
        "sectionQuality": {},
        "sections": {
            "topStories": [make_story(1, "topStories", "a")],
        },
    })

    gate.write_json(report_path, report)
    gate.write_summary(report)

    assert report_path.exists()
    assert summary_path.exists()
    assert "Sections Prefetch Quality Report" in summary_path.read_text()
