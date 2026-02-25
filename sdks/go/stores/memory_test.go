package stores

import (
	"testing"
	"time"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func makeTestData(id string) *xagentauth.ChallengeData {
	return &xagentauth.ChallengeData{
		ID:            id,
		ChallengeType: "test",
		Difficulty:    xagentauth.DifficultyEasy,
		AnswerHash:    "abc123",
		SessionToken:  "st_test",
	}
}

func TestMemoryStore_SetAndGet(t *testing.T) {
	store := NewMemoryStore()
	data := makeTestData("ch_1")

	if err := store.Set("ch_1", data, 60); err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	got, err := store.Get("ch_1")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if got == nil {
		t.Fatal("Expected data, got nil")
	}
	if got.ID != "ch_1" {
		t.Errorf("Expected ID ch_1, got %s", got.ID)
	}
	if got.AnswerHash != "abc123" {
		t.Errorf("Expected AnswerHash abc123, got %s", got.AnswerHash)
	}
}

func TestMemoryStore_TTLExpiry(t *testing.T) {
	store := NewMemoryStore()
	data := makeTestData("ch_expire")

	// Set with 1-second TTL
	if err := store.Set("ch_expire", data, 1); err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	// Should exist immediately
	got, _ := store.Get("ch_expire")
	if got == nil {
		t.Fatal("Expected data before expiry, got nil")
	}

	// Wait for expiry
	time.Sleep(1100 * time.Millisecond)

	got, _ = store.Get("ch_expire")
	if got != nil {
		t.Error("Expected nil after TTL expiry, got data")
	}
}

func TestMemoryStore_GetMissing(t *testing.T) {
	store := NewMemoryStore()

	got, err := store.Get("nonexistent")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if got != nil {
		t.Error("Expected nil for missing key, got data")
	}
}

func TestMemoryStore_Delete(t *testing.T) {
	store := NewMemoryStore()
	data := makeTestData("ch_del")

	if err := store.Set("ch_del", data, 60); err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	if err := store.Delete("ch_del"); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	got, _ := store.Get("ch_del")
	if got != nil {
		t.Error("Expected nil after delete, got data")
	}
}
