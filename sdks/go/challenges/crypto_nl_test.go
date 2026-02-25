package challenges

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

func TestCryptoNL_Name(t *testing.T) {
	d := &CryptoNLDriver{}
	if d.Name() != "crypto-nl" {
		t.Errorf("Expected name crypto-nl, got %s", d.Name())
	}
}

func TestCryptoNL_Dimensions(t *testing.T) {
	d := &CryptoNLDriver{}
	dims := d.Dimensions()
	if len(dims) != 2 {
		t.Fatalf("Expected 2 dimensions, got %d", len(dims))
	}
	if dims[0] != xagentauth.DimensionReasoning || dims[1] != xagentauth.DimensionExecution {
		t.Errorf("Unexpected dimensions: %v", dims)
	}
}

func TestCryptoNL_GenerateAndVerify(t *testing.T) {
	d := &CryptoNLDriver{}

	for _, diff := range []xagentauth.Difficulty{
		xagentauth.DifficultyEasy,
		xagentauth.DifficultyMedium,
		xagentauth.DifficultyHard,
		xagentauth.DifficultyAdversarial,
	} {
		t.Run(string(diff), func(t *testing.T) {
			payload, answerHash, err := d.Generate(diff)
			if err != nil {
				t.Fatalf("Generate failed: %v", err)
			}

			if payload.Type != "crypto-nl" {
				t.Errorf("Expected type crypto-nl, got %s", payload.Type)
			}
			if payload.Data == "" {
				t.Error("Expected non-empty data")
			}
			if answerHash == "" {
				t.Error("Expected non-empty answer hash")
			}
			if len(answerHash) != 64 {
				t.Errorf("Expected 64-char answer hash, got %d chars", len(answerHash))
			}

			// Solve the challenge by re-executing the ops
			data, err := base64.StdEncoding.DecodeString(payload.Data)
			if err != nil {
				t.Fatalf("Failed to decode data: %v", err)
			}

			var ctx struct {
				Ops []ByteOperation `json:"ops"`
			}
			if err := json.Unmarshal(payload.Context, &ctx); err != nil {
				t.Fatalf("Failed to unmarshal context: %v", err)
			}

			result, err := executeOps(data, ctx.Ops)
			if err != nil {
				t.Fatalf("Failed to execute ops: %v", err)
			}

			answer := xagentauth.SHA256Hex(result)
			ok, err := d.Verify(answerHash, answer)
			if err != nil {
				t.Fatalf("Verify failed: %v", err)
			}
			if !ok {
				t.Error("Expected verification to succeed")
			}
		})
	}
}

func TestCryptoNL_VerifyWrongAnswer(t *testing.T) {
	d := &CryptoNLDriver{}
	payload, answerHash, err := d.Generate(xagentauth.DifficultyEasy)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}
	_ = payload

	ok, err := d.Verify(answerHash, "wrong_answer")
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
	if ok {
		t.Error("Expected verification to fail for wrong answer")
	}
}

func TestCryptoNL_ApplyOps(t *testing.T) {
	// Test individual ops
	data := []byte{0x01, 0x02, 0x03, 0x04}

	// XOR
	xored, err := applyOp(data, ByteOperation{Op: OpXOR, Params: map[string]string{"key": "255"}})
	if err != nil {
		t.Fatalf("XOR failed: %v", err)
	}
	if xored[0] != 0xFE {
		t.Errorf("XOR: expected 0xFE, got 0x%02X", xored[0])
	}

	// Reverse
	reversed, err := applyOp(data, ByteOperation{Op: OpReverse, Params: map[string]string{}})
	if err != nil {
		t.Fatalf("Reverse failed: %v", err)
	}
	if reversed[0] != 0x04 || reversed[3] != 0x01 {
		t.Errorf("Reverse: expected [04,03,02,01], got %v", reversed)
	}

	// Sort
	unsorted := []byte{0x03, 0x01, 0x04, 0x02}
	sorted, err := applyOp(unsorted, ByteOperation{Op: OpSort, Params: map[string]string{}})
	if err != nil {
		t.Fatalf("Sort failed: %v", err)
	}
	for i := 0; i < 4; i++ {
		if sorted[i] != byte(i+1) {
			t.Errorf("Sort: expected %d at index %d, got %d", i+1, i, sorted[i])
		}
	}

	// BitwiseNot
	notted, err := applyOp([]byte{0x00, 0xFF}, ByteOperation{Op: OpBitwiseNot, Params: map[string]string{}})
	if err != nil {
		t.Fatalf("BitwiseNot failed: %v", err)
	}
	if notted[0] != 0xFF || notted[1] != 0x00 {
		t.Errorf("BitwiseNot: expected [FF,00], got [%02X,%02X]", notted[0], notted[1])
	}
}
