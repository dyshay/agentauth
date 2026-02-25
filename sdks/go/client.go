package xagentauth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Client is the AgentAuth HTTP client.
type Client struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

// NewClient creates a new AgentAuth client.
func NewClient(config ClientConfig) *Client {
	timeout := time.Duration(config.TimeoutMs) * time.Millisecond
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	return &Client{
		httpClient: &http.Client{
			Timeout: timeout,
		},
		baseURL: strings.TrimSuffix(config.BaseURL, "/"),
		apiKey:  config.APIKey,
	}
}

// InitChallenge initializes a new challenge.
func (c *Client) InitChallenge(difficulty Difficulty, dimensions []ChallengeDimension) (*InitChallengeResponse, error) {
	url := fmt.Sprintf("%s/v1/challenge/init", c.baseURL)

	body := make(map[string]interface{})
	if difficulty != "" {
		body["difficulty"] = difficulty
	}
	if dimensions != nil {
		body["dimensions"] = dimensions
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(body); err != nil {
		return nil, fmt.Errorf("failed to encode request body: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, &buf)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := c.checkResponse(resp); err != nil {
		return nil, err
	}

	var result InitChallengeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// GetChallenge retrieves a challenge by ID.
func (c *Client) GetChallenge(id, sessionToken string) (*ChallengeResponse, error) {
	url := fmt.Sprintf("%s/v1/challenge/%s", c.baseURL, id)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", sessionToken))

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := c.checkResponse(resp); err != nil {
		return nil, err
	}

	var result ChallengeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// Solve submits a solution to a challenge.
func (c *Client) Solve(id, answer, sessionToken string, canaryResponses map[string]string, metadata *SolveMetadata) (*SolveResponse, *AgentAuthHeaders, error) {
	url := fmt.Sprintf("%s/v1/challenge/%s/solve", c.baseURL, id)

	// Auto-compute HMAC
	hmac := HmacSHA256Hex(answer, sessionToken)

	solveReq := SolveRequest{
		Answer:          answer,
		HMAC:            hmac,
		CanaryResponses: canaryResponses,
		Metadata:        metadata,
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(solveReq); err != nil {
		return nil, nil, fmt.Errorf("failed to encode request body: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, &buf)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", sessionToken))

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	// Extract headers before checking response
	headers := c.extractHeaders(resp.Header)

	if err := c.checkResponse(resp); err != nil {
		return nil, headers, err
	}

	var result SolveResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, headers, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, headers, nil
}

// VerifyToken verifies an authentication token.
func (c *Client) VerifyToken(token string) (*VerifyTokenResponse, error) {
	url := fmt.Sprintf("%s/v1/token/verify", c.baseURL)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := c.checkResponse(resp); err != nil {
		return nil, err
	}

	var result VerifyTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// Authenticate performs the full authentication flow.
func (c *Client) Authenticate(difficulty Difficulty, dimensions []ChallengeDimension, solver SolverFunc) (*AuthenticateResult, error) {
	// Step 1: Initialize challenge
	initResp, err := c.InitChallenge(difficulty, dimensions)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize challenge: %w", err)
	}

	// Step 2: Get challenge
	challenge, err := c.GetChallenge(initResp.ID, initResp.SessionToken)
	if err != nil {
		return nil, fmt.Errorf("failed to get challenge: %w", err)
	}

	// Step 3: Solve challenge using provided solver
	answer, canaryResponses, err := solver(*challenge)
	if err != nil {
		return nil, fmt.Errorf("solver failed: %w", err)
	}

	// Step 4: Submit solution
	solveResp, headers, err := c.Solve(initResp.ID, answer, initResp.SessionToken, canaryResponses, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to solve challenge: %w", err)
	}

	return &AuthenticateResult{
		Success:        solveResp.Success,
		Token:          solveResp.Token,
		Score:          solveResp.Score,
		ModelIdentity:  solveResp.ModelIdentity,
		TimingAnalysis: solveResp.TimingAnalysis,
		Reason:         solveResp.Reason,
		Headers:        headers,
	}, nil
}

// doRequest executes an HTTP request with default headers.
func (c *Client) doRequest(req *http.Request) (*http.Response, error) {
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	return resp, nil
}

// checkResponse checks for HTTP errors and returns an AgentAuthError if present.
func (c *Client) checkResponse(resp *http.Response) error {
	if resp.StatusCode < 400 {
		return nil
	}

	// Try to parse error response
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return &AgentAuthError{
			StatusCode: resp.StatusCode,
			Message:    fmt.Sprintf("HTTP %d: failed to read error response", resp.StatusCode),
		}
	}

	var errorResp struct {
		Error   string `json:"error"`
		Message string `json:"message"`
	}

	if err := json.Unmarshal(bodyBytes, &errorResp); err != nil {
		return &AgentAuthError{
			StatusCode: resp.StatusCode,
			Message:    fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(bodyBytes)),
		}
	}

	message := errorResp.Error
	if errorResp.Message != "" {
		message = errorResp.Message
	}
	if message == "" {
		message = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}

	return &AgentAuthError{
		StatusCode: resp.StatusCode,
		Message:    message,
		ErrorType:  errorResp.Error,
	}
}

// extractHeaders parses AgentAuth-* response headers.
func (c *Client) extractHeaders(header http.Header) *AgentAuthHeaders {
	headers := &AgentAuthHeaders{}

	if v := header.Get("AgentAuth-Status"); v != "" {
		headers.Status = &v
	}
	if v := header.Get("AgentAuth-Model-Family"); v != "" {
		headers.ModelFamily = &v
	}
	if v := header.Get("AgentAuth-Capabilities"); v != "" {
		headers.Capabilities = &v
	}
	if v := header.Get("AgentAuth-Version"); v != "" {
		headers.Version = &v
	}
	if v := header.Get("AgentAuth-Challenge-Id"); v != "" {
		headers.ChallengeID = &v
	}
	if v := header.Get("AgentAuth-Score"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			headers.Score = &f
		}
	}
	if v := header.Get("AgentAuth-PoMI-Confidence"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			headers.PomiConfidence = &f
		}
	}
	if v := header.Get("AgentAuth-Token-Expires"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			headers.TokenExpires = &n
		}
	}

	return headers
}
