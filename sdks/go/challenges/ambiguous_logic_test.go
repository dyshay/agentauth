package challenges

import (
	"encoding/json"
	"testing"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func TestAmbiguous_Name(t *testing.T) {
	d := &AmbiguousLogicDriver{}
	if d.Name() != "ambiguous-logic" {
		t.Errorf("Expected name ambiguous-logic, got %s", d.Name())
	}
}

func TestAmbiguous_Dimensions(t *testing.T) {
	d := &AmbiguousLogicDriver{}
	dims := d.Dimensions()
	if len(dims) != 2 {
		t.Fatalf("Expected 2 dimensions, got %d", len(dims))
	}
	if dims[1] != xagentauth.DimensionAmbiguity {
		t.Errorf("Expected ambiguity dimension, got %s", dims[1])
	}
}

func TestAmbiguous_GenerateAndVerify(t *testing.T) {
	d := &AmbiguousLogicDriver{}

	for _, diff := range []xagentauth.Difficulty{
		xagentauth.DifficultyEasy,
		xagentauth.DifficultyMedium,
		xagentauth.DifficultyHard,
	} {
		t.Run(string(diff), func(t *testing.T) {
			payload, answerHash, err := d.Generate(diff)
			if err != nil {
				t.Fatalf("Generate failed: %v", err)
			}

			if payload.Type != "ambiguous-logic" {
				t.Errorf("Expected type ambiguous-logic, got %s", payload.Type)
			}
			if answerHash == "" {
				t.Error("Expected non-empty answer hash")
			}

			// Extract primary answer from context
			var ctx struct {
				PrimaryAnswer string `json:"primaryAnswer"`
			}
			if err := json.Unmarshal(payload.Context, &ctx); err != nil {
				t.Fatalf("Failed to unmarshal context: %v", err)
			}

			ok, err := d.Verify(answerHash, ctx.PrimaryAnswer)
			if err != nil {
				t.Fatalf("Verify failed: %v", err)
			}
			if !ok {
				t.Error("Expected verification to succeed with primary answer")
			}
		})
	}
}

func TestAmbiguous_VerifyWrongAnswer(t *testing.T) {
	d := &AmbiguousLogicDriver{}
	_, answerHash, err := d.Generate(xagentauth.DifficultyEasy)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	ok, err := d.Verify(answerHash, "wrong_answer_hex")
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
	if ok {
		t.Error("Expected verification to fail for wrong answer")
	}
}

func TestAmbiguous_Helpers(t *testing.T) {
	data := []byte{0x01, 0x02, 0x03, 0x04}

	// XOR
	xored := xorBytesArr(data, 0xFF)
	if xored[0] != 0xFE {
		t.Errorf("XOR: expected 0xFE, got 0x%02X", xored[0])
	}

	// Sort
	unsorted := []byte{0x04, 0x02, 0x03, 0x01}
	sorted := sortAscending(unsorted)
	for i := 0; i < 4; i++ {
		if sorted[i] != byte(i+1) {
			t.Errorf("Sort: expected %d at index %d, got %d", i+1, i, sorted[i])
		}
	}

	// Reverse
	reversed := reverseBytes(data)
	if reversed[0] != 0x04 || reversed[3] != 0x01 {
		t.Errorf("Reverse: unexpected result %v", reversed)
	}
}
