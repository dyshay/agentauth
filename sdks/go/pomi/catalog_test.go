package pomi

import (
	"testing"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func TestCatalog_DefaultHas17Canaries(t *testing.T) {
	catalog := NewCanaryCatalog(nil)
	list := catalog.List()
	if len(list) != 17 {
		t.Errorf("Expected 17 default canaries, got %d", len(list))
	}
}

func TestCatalog_Version(t *testing.T) {
	catalog := NewCanaryCatalog(nil)
	if catalog.Version != CatalogVersion {
		t.Errorf("Expected version %s, got %s", CatalogVersion, catalog.Version)
	}
}

func TestCatalog_Get(t *testing.T) {
	catalog := NewCanaryCatalog(nil)
	c := catalog.Get("unicode-rtl")
	if c == nil {
		t.Fatal("Expected to find unicode-rtl canary")
	}
	if c.ID != "unicode-rtl" {
		t.Errorf("Expected ID unicode-rtl, got %s", c.ID)
	}
}

func TestCatalog_GetMissing(t *testing.T) {
	catalog := NewCanaryCatalog(nil)
	c := catalog.Get("nonexistent")
	if c != nil {
		t.Error("Expected nil for missing canary")
	}
}

func TestCatalog_Select(t *testing.T) {
	catalog := NewCanaryCatalog(nil)
	selected := catalog.Select(3, nil)
	if len(selected) != 3 {
		t.Errorf("Expected 3 selected canaries, got %d", len(selected))
	}
	// Check that all are different
	ids := make(map[string]bool)
	for _, c := range selected {
		if ids[c.ID] {
			t.Errorf("Duplicate canary ID: %s", c.ID)
		}
		ids[c.ID] = true
	}
}

func TestCatalog_SelectByMethod(t *testing.T) {
	catalog := NewCanaryCatalog(nil)
	method := xagentauth.InjectionInline
	selected := catalog.Select(20, &CatalogSelectOptions{Method: &method})
	for _, c := range selected {
		if c.InjectionMethod != xagentauth.InjectionInline {
			t.Errorf("Expected inline injection method, got %s", c.InjectionMethod)
		}
	}
}

func TestCatalog_SelectExclude(t *testing.T) {
	catalog := NewCanaryCatalog(nil)
	selected := catalog.Select(20, &CatalogSelectOptions{Exclude: []string{"unicode-rtl", "math-precision"}})
	for _, c := range selected {
		if c.ID == "unicode-rtl" || c.ID == "math-precision" {
			t.Errorf("Excluded canary %s was selected", c.ID)
		}
	}
}
