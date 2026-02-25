package xagentauth

import "testing"

// mockDriver is a simple mock for testing the registry.
type mockDriver struct {
	name       string
	dimensions []ChallengeDimension
}

func (m *mockDriver) Name() string                     { return m.name }
func (m *mockDriver) Dimensions() []ChallengeDimension { return m.dimensions }
func (m *mockDriver) EstimatedHumanTimeMs() int64      { return 60000 }
func (m *mockDriver) EstimatedAITimeMs() int64         { return 500 }
func (m *mockDriver) Generate(d Difficulty) (*ChallengePayload, string, error) {
	return &ChallengePayload{Type: m.name}, "hash", nil
}
func (m *mockDriver) Verify(answerHash string, submitted string) (bool, error) {
	return answerHash == submitted, nil
}

func TestRegistry_RegisterAndGet(t *testing.T) {
	reg := NewChallengeRegistry()
	d := &mockDriver{name: "test-driver", dimensions: []ChallengeDimension{DimensionReasoning}}
	reg.Register(d)

	got := reg.Get("test-driver")
	if got == nil {
		t.Fatal("Expected driver, got nil")
	}
	if got.Name() != "test-driver" {
		t.Errorf("Expected name test-driver, got %s", got.Name())
	}
}

func TestRegistry_GetMissing(t *testing.T) {
	reg := NewChallengeRegistry()
	got := reg.Get("nonexistent")
	if got != nil {
		t.Error("Expected nil for missing driver")
	}
}

func TestRegistry_List(t *testing.T) {
	reg := NewChallengeRegistry()
	reg.Register(&mockDriver{name: "a", dimensions: []ChallengeDimension{DimensionReasoning}})
	reg.Register(&mockDriver{name: "b", dimensions: []ChallengeDimension{DimensionExecution}})

	list := reg.List()
	if len(list) != 2 {
		t.Errorf("Expected 2 drivers, got %d", len(list))
	}
}

func TestRegistry_SelectByDimension(t *testing.T) {
	reg := NewChallengeRegistry()
	reg.Register(&mockDriver{name: "reasoning-only", dimensions: []ChallengeDimension{DimensionReasoning}})
	reg.Register(&mockDriver{name: "exec-only", dimensions: []ChallengeDimension{DimensionExecution}})
	reg.Register(&mockDriver{name: "both", dimensions: []ChallengeDimension{DimensionReasoning, DimensionExecution}})

	// Select drivers matching "reasoning" dimension
	selected := reg.Select([]ChallengeDimension{DimensionReasoning}, 2)
	if len(selected) != 2 {
		t.Fatalf("Expected 2 selected, got %d", len(selected))
	}
	// The first one should have the best score for reasoning
	first := selected[0]
	if first.Name() != "reasoning-only" && first.Name() != "both" {
		t.Errorf("Expected reasoning-matching driver first, got %s", first.Name())
	}
}

func TestRegistry_SelectNoDimensions(t *testing.T) {
	reg := NewChallengeRegistry()
	reg.Register(&mockDriver{name: "a", dimensions: []ChallengeDimension{DimensionReasoning}})
	reg.Register(&mockDriver{name: "b", dimensions: []ChallengeDimension{DimensionExecution}})

	selected := reg.Select(nil, 1)
	if len(selected) != 1 {
		t.Fatalf("Expected 1 selected, got %d", len(selected))
	}
}
