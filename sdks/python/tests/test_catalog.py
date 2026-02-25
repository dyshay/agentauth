from __future__ import annotations


from xagentauth.pomi.catalog import CanaryCatalog


def test_default_catalog_has_17_canaries():
    catalog = CanaryCatalog()
    assert len(catalog.list()) == 17


def test_get_by_id():
    catalog = CanaryCatalog()
    canary = catalog.get("unicode-rtl")
    assert canary is not None
    assert canary.id == "unicode-rtl"
    assert canary.injection_method == "inline"


def test_get_nonexistent():
    catalog = CanaryCatalog()
    assert catalog.get("nonexistent") is None


def test_select_with_count():
    catalog = CanaryCatalog()
    selected = catalog.select(3)
    assert len(selected) == 3
    # All IDs should be unique
    ids = [c.id for c in selected]
    assert len(set(ids)) == 3
