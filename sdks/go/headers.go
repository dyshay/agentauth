package xagentauth

import (
	"fmt"
	"strconv"
	"strings"
)

// Header name constants matching the TypeScript AGENTAUTH_HEADERS.
const (
	HeaderStatus         = "AgentAuth-Status"
	HeaderScore          = "AgentAuth-Score"
	HeaderModelFamily    = "AgentAuth-Model-Family"
	HeaderPoMIConfidence = "AgentAuth-PoMI-Confidence"
	HeaderCapabilities   = "AgentAuth-Capabilities"
	HeaderVersion        = "AgentAuth-Version"
	HeaderChallengeID    = "AgentAuth-Challenge-Id"
	HeaderTokenExpires   = "AgentAuth-Token-Expires"
)

// FormatCapabilities formats capability scores as a comma-separated key=value string.
// Example: "reasoning=0.9,execution=0.85,autonomy=0.8,speed=0.75,consistency=0.88"
func FormatCapabilities(score AgentCapabilityScore) string {
	return fmt.Sprintf(
		"reasoning=%g,execution=%g,autonomy=%g,speed=%g,consistency=%g",
		score.Reasoning, score.Execution, score.Autonomy, score.Speed, score.Consistency,
	)
}

// ParseCapabilities parses a capabilities header string into a map of dimension -> score.
// Example: "reasoning=0.9,execution=0.85" -> {"reasoning": 0.9, "execution": 0.85}
func ParseCapabilities(header string) map[string]float64 {
	result := make(map[string]float64)
	if header == "" {
		return result
	}
	for _, part := range strings.Split(header, ",") {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key := strings.TrimSpace(kv[0])
		val, err := strconv.ParseFloat(strings.TrimSpace(kv[1]), 64)
		if err != nil {
			continue
		}
		result[key] = val
	}
	return result
}
