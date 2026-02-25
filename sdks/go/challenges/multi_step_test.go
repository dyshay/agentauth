package challenges

import (
	"encoding/json"
	"testing"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func TestMultiStep_Name(t *testing.T) {
	d := &MultiStepDriver{}
	if d.Name() != "multi-step" {
		t.Errorf("Expected name multi-step, got %s", d.Name())
	}
}

func TestMultiStep_Dimensions(t *testing.T) {
	d := &MultiStepDriver{}
	dims := d.Dimensions()
	if len(dims) != 3 {
		t.Fatalf("Expected 3 dimensions, got %d", len(dims))
	}
	if dims[2] != xagentauth.DimensionMemory {
		t.Errorf("Expected memory dimension, got %s", dims[2])
	}
}

func TestMultiStep_GenerateAndVerify(t *testing.T) {
	d := &MultiStepDriver{}

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

			if payload.Type != "multi-step" {
				t.Errorf("Expected type multi-step, got %s", payload.Type)
			}
			if answerHash == "" {
				t.Error("Expected non-empty answer hash")
			}

			// Extract expected answer from context
			var ctx struct {
				ExpectedAnswer string `json:"expectedAnswer"`
			}
			if err := json.Unmarshal(payload.Context, &ctx); err != nil {
				t.Fatalf("Failed to unmarshal context: %v", err)
			}

			ok, err := d.Verify(answerHash, ctx.ExpectedAnswer)
			if err != nil {
				t.Fatalf("Verify failed: %v", err)
			}
			if !ok {
				t.Error("Expected verification to succeed with expected answer")
			}
		})
	}
}

func TestMultiStep_VerifyWrongAnswer(t *testing.T) {
	d := &MultiStepDriver{}
	_, answerHash, err := d.Generate(xagentauth.DifficultyEasy)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	ok, err := d.Verify(answerHash, "wrong_answer")
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
	if ok {
		t.Error("Expected verification to fail for wrong answer")
	}
}

func TestMultiStep_StepExecution(t *testing.T) {
	// Test basic step execution manually
	inputHex := "0102030405060708"

	// SHA256 step
	result := executeStepMS(0, stepDef{Type: stepSHA256}, inputHex, nil)
	if len(result) != 64 {
		t.Errorf("SHA256 step: expected 64-char hex, got %d", len(result))
	}

	// XOR step
	result2 := executeStepMS(0, stepDef{Type: stepXOR, Key: 0xFF}, inputHex, nil)
	if len(result2) != len(inputHex) {
		t.Errorf("XOR step: expected same length, got %d", len(result2))
	}
}
