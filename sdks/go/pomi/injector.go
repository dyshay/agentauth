package pomi

import (
	"fmt"
	"strings"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

// InjectionResult contains the modified payload and the canaries that were injected.
type InjectionResult struct {
	Payload  xagentauth.ChallengePayload
	Injected []xagentauth.Canary
}

// InjectOptions configures canary injection.
type InjectOptions struct {
	Exclude []string
}

// CanaryInjector injects canary prompts into challenge payloads.
type CanaryInjector struct {
	catalog *CanaryCatalog
}

// NewCanaryInjector creates a new CanaryInjector.
func NewCanaryInjector(catalog *CanaryCatalog) *CanaryInjector {
	return &CanaryInjector{catalog: catalog}
}

// Inject selects canaries from the catalog and injects them into the
// challenge instructions, grouped by injection method.
func (inj *CanaryInjector) Inject(payload xagentauth.ChallengePayload, count int, options *InjectOptions) InjectionResult {
	if count <= 0 {
		return InjectionResult{Payload: payload, Injected: nil}
	}

	var selectOpts *CatalogSelectOptions
	if options != nil && len(options.Exclude) > 0 {
		selectOpts = &CatalogSelectOptions{Exclude: options.Exclude}
	}

	selected := inj.catalog.Select(count, selectOpts)
	if len(selected) == 0 {
		return InjectionResult{Payload: payload, Injected: nil}
	}

	// Group by injection method
	var prefixCanaries, inlineCanaries, suffixCanaries, embeddedCanaries []xagentauth.Canary
	for _, c := range selected {
		switch c.InjectionMethod {
		case xagentauth.InjectionPrefix:
			prefixCanaries = append(prefixCanaries, c)
		case xagentauth.InjectionInline:
			inlineCanaries = append(inlineCanaries, c)
		case xagentauth.InjectionSuffix:
			suffixCanaries = append(suffixCanaries, c)
		case xagentauth.InjectionEmbedded:
			embeddedCanaries = append(embeddedCanaries, c)
		}
	}

	instructions := payload.Instructions

	// Prefix: add before main instructions
	if len(prefixCanaries) > 0 {
		var lines []string
		for _, c := range prefixCanaries {
			lines = append(lines, fmt.Sprintf("- %s: %s", c.ID, c.Prompt))
		}
		prefixText := strings.Join(lines, "\n")
		instructions = fmt.Sprintf("Before starting, answer these briefly (include in canary_responses):\n%s\n\n%s", prefixText, instructions)
	}

	// Inline, Suffix, and Embedded: add as side tasks after main instructions
	var sideTaskCanaries []xagentauth.Canary
	sideTaskCanaries = append(sideTaskCanaries, inlineCanaries...)
	sideTaskCanaries = append(sideTaskCanaries, suffixCanaries...)
	sideTaskCanaries = append(sideTaskCanaries, embeddedCanaries...)

	if len(sideTaskCanaries) > 0 {
		var lines []string
		for _, c := range sideTaskCanaries {
			lines = append(lines, fmt.Sprintf("- %s: %s", c.ID, c.Prompt))
		}
		sideText := strings.Join(lines, "\n")
		instructions = fmt.Sprintf("%s\n\nAlso, complete these side tasks (include answers in canary_responses field):\n%s", instructions, sideText)
	}

	newPayload := payload
	newPayload.Instructions = instructions

	return InjectionResult{Payload: newPayload, Injected: selected}
}
