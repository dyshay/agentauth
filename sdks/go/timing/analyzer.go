package timing

import (
	"fmt"
	"math"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

// AnalyzeParams contains the parameters for timing analysis.
type AnalyzeParams struct {
	ElapsedMs     float64
	ChallengeType string
	Difficulty    xagentauth.Difficulty
	RTTMs         float64
}

// TimingAnalyzer classifies response timing into zones and computes
// penalties, z-scores, and confidence levels.
type TimingAnalyzer struct {
	baselines map[string]xagentauth.TimingBaseline
	defaults  struct {
		tooFast float64
		aiLower float64
		aiUpper float64
		human   float64
		timeout float64
	}
}

// NewTimingAnalyzer creates a new TimingAnalyzer from the given config.
func NewTimingAnalyzer(config *xagentauth.TimingConfig) *TimingAnalyzer {
	ta := &TimingAnalyzer{
		baselines: make(map[string]xagentauth.TimingBaseline),
	}

	allBaselines := DefaultBaselines
	if config != nil && len(config.Baselines) > 0 {
		allBaselines = config.Baselines
	}
	for _, b := range allBaselines {
		key := fmt.Sprintf("%s:%s", b.ChallengeType, b.Difficulty)
		ta.baselines[key] = b
	}

	ta.defaults.tooFast = 50
	ta.defaults.aiLower = 50
	ta.defaults.aiUpper = 2000
	ta.defaults.human = 10000
	ta.defaults.timeout = 30000

	if config != nil {
		if config.DefaultTooFastMs > 0 {
			ta.defaults.tooFast = config.DefaultTooFastMs
		}
		if config.DefaultAILowerMs > 0 {
			ta.defaults.aiLower = config.DefaultAILowerMs
		}
		if config.DefaultAIUpperMs > 0 {
			ta.defaults.aiUpper = config.DefaultAIUpperMs
		}
		if config.DefaultHumanMs > 0 {
			ta.defaults.human = config.DefaultHumanMs
		}
		if config.DefaultTimeoutMs > 0 {
			ta.defaults.timeout = config.DefaultTimeoutMs
		}
	}

	return ta
}

// Analyze classifies the elapsed time into a timing zone and computes metrics.
func (ta *TimingAnalyzer) Analyze(params AnalyzeParams) xagentauth.TimingAnalysis {
	key := fmt.Sprintf("%s:%s", params.ChallengeType, params.Difficulty)
	baseline, ok := ta.baselines[key]
	if !ok {
		baseline = ta.makeDefaultBaseline()
	}

	// Apply RTT tolerance to zone boundaries
	tolerance := 0.0
	if params.RTTMs > 0 {
		tolerance = math.Max(params.RTTMs*0.5, 200)
	}
	adjustedBaseline := baseline
	if tolerance > 0 {
		adjustedBaseline.AIUpperMs = baseline.AIUpperMs + tolerance
		adjustedBaseline.HumanMs = baseline.HumanMs + tolerance
	}

	zone := ta.classifyZone(params.ElapsedMs, adjustedBaseline)
	penalty := ta.computePenalty(zone, params.ElapsedMs, adjustedBaseline)
	zScore := ta.computeZScore(params.ElapsedMs, baseline)
	confidence := ta.computeConfidence(params.ElapsedMs, adjustedBaseline, zone)
	details := ta.describeZone(zone, params.ElapsedMs, adjustedBaseline)

	// Round-number detection: flag suspiciously round elapsed times in ai_zone
	isRound := int(params.ElapsedMs)%500 == 0 || int(params.ElapsedMs)%100 == 0
	if isRound && zone == xagentauth.ZoneAI && params.ElapsedMs > 0 {
		confidence = math.Round(confidence*0.85*1000) / 1000
		details += " [round-number timing detected]"
	}

	return xagentauth.TimingAnalysis{
		ElapsedMs:  params.ElapsedMs,
		Zone:       string(zone),
		Confidence: confidence,
		ZScore:     math.Round(zScore*100) / 100,
		Penalty:    math.Round(penalty*1000) / 1000,
		Details:    details,
	}
}

// AnalyzePattern performs pattern analysis on a series of step timings.
func (ta *TimingAnalyzer) AnalyzePattern(stepTimings []float64) xagentauth.TimingPatternAnalysis {
	if len(stepTimings) < 2 {
		return xagentauth.TimingPatternAnalysis{
			VarianceCoefficient: 0,
			Trend:               "constant",
			RoundNumberRatio:    0,
			Verdict:             "inconclusive",
		}
	}

	mean := 0.0
	for _, t := range stepTimings {
		mean += t
	}
	mean /= float64(len(stepTimings))

	variance := 0.0
	for _, t := range stepTimings {
		diff := t - mean
		variance += diff * diff
	}
	variance /= float64(len(stepTimings))
	std := math.Sqrt(variance)

	vc := 0.0
	if mean > 0 {
		vc = std / mean
	}

	trend := ta.detectTrend(stepTimings)

	// Round number detection
	roundCount := 0
	for _, t := range stepTimings {
		ti := int(t)
		if ti%500 == 0 || (ti%100 == 0 && ti%500 != 0) {
			roundCount++
		}
	}
	roundRatio := float64(roundCount) / float64(len(stepTimings))

	// Verdict
	verdict := "inconclusive"
	if vc < 0.05 && len(stepTimings) >= 3 {
		verdict = "artificial"
	} else if roundRatio > 0.5 {
		verdict = "artificial"
	} else if vc > 0.1 {
		verdict = "natural"
	}

	return xagentauth.TimingPatternAnalysis{
		VarianceCoefficient: math.Round(vc*1000) / 1000,
		Trend:               trend,
		RoundNumberRatio:    math.Round(roundRatio*100) / 100,
		Verdict:             verdict,
	}
}

func (ta *TimingAnalyzer) makeDefaultBaseline() xagentauth.TimingBaseline {
	return xagentauth.TimingBaseline{
		ChallengeType: "default",
		Difficulty:    xagentauth.DifficultyMedium,
		MeanMs:        (ta.defaults.aiLower + ta.defaults.aiUpper) / 2,
		StdMs:         (ta.defaults.aiUpper - ta.defaults.aiLower) / 4,
		TooFastMs:     ta.defaults.tooFast,
		AILowerMs:     ta.defaults.aiLower,
		AIUpperMs:     ta.defaults.aiUpper,
		HumanMs:       ta.defaults.human,
		TimeoutMs:     ta.defaults.timeout,
	}
}

func (ta *TimingAnalyzer) classifyZone(elapsed float64, baseline xagentauth.TimingBaseline) xagentauth.TimingZone {
	if elapsed < baseline.TooFastMs {
		return xagentauth.ZoneTooFast
	}
	if elapsed >= baseline.TooFastMs && elapsed <= baseline.AIUpperMs {
		return xagentauth.ZoneAI
	}
	if elapsed > baseline.AIUpperMs && elapsed <= baseline.HumanMs {
		return xagentauth.ZoneSuspicious
	}
	if elapsed > baseline.HumanMs && elapsed <= baseline.TimeoutMs {
		return xagentauth.ZoneHuman
	}
	return xagentauth.ZoneTimeout
}

func (ta *TimingAnalyzer) computePenalty(zone xagentauth.TimingZone, elapsed float64, baseline xagentauth.TimingBaseline) float64 {
	switch zone {
	case xagentauth.ZoneTooFast:
		return 1.0
	case xagentauth.ZoneAI:
		return 0.0
	case xagentauth.ZoneSuspicious:
		rangeVal := baseline.HumanMs - baseline.AIUpperMs
		if rangeVal <= 0 {
			return 0.5
		}
		position := (elapsed - baseline.AIUpperMs) / rangeVal
		return 0.3 + position*0.4
	case xagentauth.ZoneHuman:
		return 0.9
	case xagentauth.ZoneTimeout:
		return 1.0
	}
	return 0.0
}

func (ta *TimingAnalyzer) computeZScore(elapsed float64, baseline xagentauth.TimingBaseline) float64 {
	if baseline.StdMs == 0 {
		return 0
	}
	return (elapsed - baseline.MeanMs) / baseline.StdMs
}

func (ta *TimingAnalyzer) computeConfidence(elapsed float64, baseline xagentauth.TimingBaseline, zone xagentauth.TimingZone) float64 {
	switch zone {
	case xagentauth.ZoneTooFast:
		ratio := elapsed / baseline.TooFastMs
		return math.Max(0.5, 1-ratio)
	case xagentauth.ZoneAI:
		distFromMean := math.Abs(elapsed - baseline.MeanMs)
		normalizedDist := distFromMean / baseline.StdMs
		return math.Max(0.5, math.Min(1, 1-normalizedDist*0.15))
	case xagentauth.ZoneSuspicious:
		rangeVal := baseline.HumanMs - baseline.AIUpperMs
		if rangeVal <= 0 {
			return 0.4
		}
		return 0.4 + 0.2*((elapsed-baseline.AIUpperMs)/rangeVal)
	case xagentauth.ZoneHuman:
		return 0.8
	case xagentauth.ZoneTimeout:
		return 0.95
	}
	return 0.5
}

func (ta *TimingAnalyzer) describeZone(zone xagentauth.TimingZone, elapsed float64, baseline xagentauth.TimingBaseline) string {
	ms := int(math.Round(elapsed))
	switch zone {
	case xagentauth.ZoneTooFast:
		return fmt.Sprintf("Response time %dms is below %.0fms threshold -- likely pre-computed or scripted", ms, baseline.TooFastMs)
	case xagentauth.ZoneAI:
		return fmt.Sprintf("Response time %dms is within expected AI range [%.0fms, %.0fms]", ms, baseline.AILowerMs, baseline.AIUpperMs)
	case xagentauth.ZoneSuspicious:
		return fmt.Sprintf("Response time %dms exceeds AI range -- possible human assistance", ms)
	case xagentauth.ZoneHuman:
		return fmt.Sprintf("Response time %dms exceeds %.0fms -- likely human solver", ms, baseline.HumanMs)
	case xagentauth.ZoneTimeout:
		return fmt.Sprintf("Response time %dms exceeds timeout threshold of %.0fms", ms, baseline.TimeoutMs)
	}
	return ""
}

func (ta *TimingAnalyzer) detectTrend(timings []float64) string {
	if len(timings) < 3 {
		return "variable"
	}

	n := float64(len(timings))
	xMean := (n - 1) / 2
	yMean := 0.0
	for _, t := range timings {
		yMean += t
	}
	yMean /= n

	numerator := 0.0
	denominator := 0.0
	for i, t := range timings {
		xi := float64(i) - xMean
		yi := t - yMean
		numerator += xi * yi
		denominator += xi * xi
	}

	if denominator == 0 {
		return "constant"
	}
	slope := numerator / denominator

	normalizedSlope := 0.0
	if yMean > 0 {
		normalizedSlope = slope / yMean
	}

	if math.Abs(normalizedSlope) < 0.05 {
		return "constant"
	}
	if normalizedSlope > 0.1 {
		return "increasing"
	}
	if normalizedSlope < -0.1 {
		return "decreasing"
	}
	return "variable"
}
