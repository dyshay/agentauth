package challenges

import (
	"encoding/json"
	"testing"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func TestCodeExec_Name(t *testing.T) {
	d := &CodeExecutionDriver{}
	if d.Name() != "code-execution" {
		t.Errorf("Expected name code-execution, got %s", d.Name())
	}
}

func TestCodeExec_Dimensions(t *testing.T) {
	d := &CodeExecutionDriver{}
	dims := d.Dimensions()
	if len(dims) != 2 {
		t.Fatalf("Expected 2 dimensions, got %d", len(dims))
	}
}

func TestCodeExec_GenerateAndVerify(t *testing.T) {
	d := &CodeExecutionDriver{}

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

			if payload.Type != "code-execution" {
				t.Errorf("Expected type code-execution, got %s", payload.Type)
			}
			if answerHash == "" {
				t.Error("Expected non-empty answer hash")
			}

			// Extract correct output from context
			var ctx struct {
				CorrectOutput string `json:"correctOutput"`
			}
			if err := json.Unmarshal(payload.Context, &ctx); err != nil {
				t.Fatalf("Failed to unmarshal context: %v", err)
			}

			ok, err := d.Verify(answerHash, ctx.CorrectOutput)
			if err != nil {
				t.Fatalf("Verify failed: %v", err)
			}
			if !ok {
				t.Error("Expected verification to succeed with correct output")
			}
		})
	}
}

func TestCodeExec_VerifyWrongAnswer(t *testing.T) {
	d := &CodeExecutionDriver{}
	_, answerHash, err := d.Generate(xagentauth.DifficultyEasy)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	ok, err := d.Verify(answerHash, "totally_wrong")
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
	if ok {
		t.Error("Expected verification to fail for wrong answer")
	}
}

func TestCodeExec_ByteTransformCorrectOutput(t *testing.T) {
	// Test the byte_transform template's correct output directly
	input := byteTransformGenInput()
	output := byteTransformCorrectOutput(input)
	if len(output) != 64 {
		t.Errorf("Expected 64-char SHA-256 hex, got %d chars", len(output))
	}
}
