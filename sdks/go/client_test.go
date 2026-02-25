package xagentauth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInitChallenge(t *testing.T) {
	// Mock response
	mockResponse := InitChallengeResponse{
		ID:           "ch_test123",
		SessionToken: "st_token456",
		ExpiresAt:    1708784400,
		TTLSeconds:   30,
	}

	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST request, got %s", r.Method)
		}
		if r.URL.Path != "/v1/challenge/init" {
			t.Errorf("Expected path /v1/challenge/init, got %s", r.URL.Path)
		}

		// Send response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	// Create client
	client := NewClient(ClientConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
	})

	// Test
	resp, err := client.InitChallenge(DifficultyMedium, nil)
	if err != nil {
		t.Fatalf("InitChallenge failed: %v", err)
	}

	// Verify response
	if resp.ID != mockResponse.ID {
		t.Errorf("Expected ID %s, got %s", mockResponse.ID, resp.ID)
	}
	if resp.SessionToken != mockResponse.SessionToken {
		t.Errorf("Expected SessionToken %s, got %s", mockResponse.SessionToken, resp.SessionToken)
	}
	if resp.ExpiresAt != mockResponse.ExpiresAt {
		t.Errorf("Expected ExpiresAt %d, got %d", mockResponse.ExpiresAt, resp.ExpiresAt)
	}
	if resp.TTLSeconds != mockResponse.TTLSeconds {
		t.Errorf("Expected TTLSeconds %d, got %d", mockResponse.TTLSeconds, resp.TTLSeconds)
	}
}

func TestGetChallenge(t *testing.T) {
	// Mock response
	mockResponse := ChallengeResponse{
		ID: "ch_test123",
		Payload: ChallengePayload{
			Type:         "crypto-nl",
			Instructions: "XOR each byte",
			Data:         "AQID",
			Steps:        1,
		},
		Difficulty: DifficultyEasy,
		Dimensions: []ChallengeDimension{"reasoning", "execution"},
		CreatedAt:  1708784000,
		ExpiresAt:  1708784400,
	}

	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request
		if r.Method != http.MethodGet {
			t.Errorf("Expected GET request, got %s", r.Method)
		}
		if r.URL.Path != "/v1/challenge/ch_test123" {
			t.Errorf("Expected path /v1/challenge/ch_test123, got %s", r.URL.Path)
		}

		// Verify Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader != "Bearer st_token456" {
			t.Errorf("Expected Authorization header 'Bearer st_token456', got '%s'", authHeader)
		}

		// Send response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	// Create client
	client := NewClient(ClientConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
	})

	// Test
	resp, err := client.GetChallenge("ch_test123", "st_token456")
	if err != nil {
		t.Fatalf("GetChallenge failed: %v", err)
	}

	// Verify response
	if resp.ID != mockResponse.ID {
		t.Errorf("Expected ID %s, got %s", mockResponse.ID, resp.ID)
	}
	if resp.Payload.Type != mockResponse.Payload.Type {
		t.Errorf("Expected Type %s, got %s", mockResponse.Payload.Type, resp.Payload.Type)
	}
	if resp.Payload.Instructions != mockResponse.Payload.Instructions {
		t.Errorf("Expected Instructions %s, got %s", mockResponse.Payload.Instructions, resp.Payload.Instructions)
	}
	if resp.Payload.Data != mockResponse.Payload.Data {
		t.Errorf("Expected Data %s, got %s", mockResponse.Payload.Data, resp.Payload.Data)
	}
	if resp.Difficulty != mockResponse.Difficulty {
		t.Errorf("Expected Difficulty %s, got %s", mockResponse.Difficulty, resp.Difficulty)
	}
}

func TestSolve(t *testing.T) {
	// Mock response - failed solve
	reason := "wrong_answer"
	mockResponse := SolveResponse{
		Success: false,
		Score: AgentCapabilityScore{
			Reasoning:   0,
			Execution:   0,
			Autonomy:    0,
			Speed:       0,
			Consistency: 0,
		},
		Reason: &reason,
	}

	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST request, got %s", r.Method)
		}
		if r.URL.Path != "/v1/challenge/ch_test123/solve" {
			t.Errorf("Expected path /v1/challenge/ch_test123/solve, got %s", r.URL.Path)
		}

		// Verify Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader != "Bearer st_token456" {
			t.Errorf("Expected Authorization header 'Bearer st_token456', got '%s'", authHeader)
		}

		// Verify request body
		var solveReq SolveRequest
		if err := json.NewDecoder(r.Body).Decode(&solveReq); err != nil {
			t.Errorf("Failed to decode request body: %v", err)
		}
		if solveReq.Answer == "" {
			t.Errorf("Expected non-empty answer")
		}
		if solveReq.HMAC == "" {
			t.Errorf("Expected non-empty HMAC")
		}

		// Send response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(mockResponse)
	}))
	defer server.Close()

	// Create client
	client := NewClient(ClientConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
	})

	// Test
	resp, _, err := client.Solve("ch_test123", "wrong-answer", "st_token456", nil, nil)
	if err != nil {
		t.Fatalf("Solve failed: %v", err)
	}

	// Verify response
	if resp.Success != false {
		t.Errorf("Expected Success false, got %v", resp.Success)
	}
	if resp.Reason == nil || *resp.Reason != "wrong_answer" {
		t.Errorf("Expected Reason 'wrong_answer', got %v", resp.Reason)
	}
	if resp.Score.Reasoning != 0 {
		t.Errorf("Expected Score.Reasoning 0, got %f", resp.Score.Reasoning)
	}
}

func TestHTTPError(t *testing.T) {
	// Create mock server that returns 500
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "internal_error",
			"message": "Internal server error",
		})
	}))
	defer server.Close()

	// Create client
	client := NewClient(ClientConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
	})

	// Test
	_, err := client.InitChallenge(DifficultyMedium, nil)
	if err == nil {
		t.Fatal("Expected error, got nil")
	}

	// Verify it's an AgentAuthError
	agentAuthErr, ok := err.(*AgentAuthError)
	if !ok {
		t.Fatalf("Expected AgentAuthError, got %T", err)
	}

	// Verify status code
	if agentAuthErr.StatusCode != 500 {
		t.Errorf("Expected StatusCode 500, got %d", agentAuthErr.StatusCode)
	}
}

func TestAuthenticate(t *testing.T) {
	// Create mock server with all 3 endpoints
	mux := http.NewServeMux()

	// Init endpoint
	mux.HandleFunc("/v1/challenge/init", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(InitChallengeResponse{
			ID:           "ch_test123",
			SessionToken: "st_token456",
			ExpiresAt:    1708784400,
			TTLSeconds:   30,
		})
	})

	// Get endpoint
	mux.HandleFunc("/v1/challenge/ch_test123", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(ChallengeResponse{
			ID: "ch_test123",
			Payload: ChallengePayload{
				Type:         "crypto-nl",
				Instructions: "XOR each byte",
				Data:         "AQID",
				Steps:        1,
			},
			Difficulty: DifficultyEasy,
			Dimensions: []ChallengeDimension{"reasoning", "execution"},
			CreatedAt:  1708784000,
			ExpiresAt:  1708784400,
		})
	})

	// Solve endpoint
	mux.HandleFunc("/v1/challenge/ch_test123/solve", func(w http.ResponseWriter, r *http.Request) {
		token := "jwt.token.here"
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(SolveResponse{
			Success: true,
			Score: AgentCapabilityScore{
				Reasoning:   0.9,
				Execution:   0.9,
				Autonomy:    0.9,
				Speed:       0.9,
				Consistency: 0.9,
			},
			Token: &token,
		})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	// Create client
	client := NewClient(ClientConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
	})

	// Create solver function
	solver := func(challenge ChallengeResponse) (string, map[string]string, error) {
		return "test-answer", nil, nil
	}

	// Test
	result, err := client.Authenticate(DifficultyEasy, []ChallengeDimension{"reasoning", "execution"}, solver)
	if err != nil {
		t.Fatalf("Authenticate failed: %v", err)
	}

	// Verify result
	if !result.Success {
		t.Errorf("Expected Success true, got false")
	}
	if result.Token == nil || *result.Token != "jwt.token.here" {
		t.Errorf("Expected Token 'jwt.token.here', got %v", result.Token)
	}
	if result.Score.Reasoning != 0.9 {
		t.Errorf("Expected Score.Reasoning 0.9, got %f", result.Score.Reasoning)
	}
}
