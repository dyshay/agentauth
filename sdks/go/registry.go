package xagentauth

import "sort"

// ChallengeRegistry manages registered challenge drivers.
type ChallengeRegistry struct {
	drivers map[string]ChallengeDriver
}

// NewChallengeRegistry creates a new empty ChallengeRegistry.
func NewChallengeRegistry() *ChallengeRegistry {
	return &ChallengeRegistry{drivers: make(map[string]ChallengeDriver)}
}

// Register adds a driver to the registry, keyed by its Name().
func (r *ChallengeRegistry) Register(driver ChallengeDriver) {
	r.drivers[driver.Name()] = driver
}

// Get returns a driver by name, or nil if not found.
func (r *ChallengeRegistry) Get(name string) ChallengeDriver {
	return r.drivers[name]
}

// List returns all registered drivers.
func (r *ChallengeRegistry) List() []ChallengeDriver {
	result := make([]ChallengeDriver, 0, len(r.drivers))
	for _, d := range r.drivers {
		result = append(result, d)
	}
	return result
}

// Select returns up to count drivers best matching the given dimensions.
// If dimensions is empty, all drivers are eligible.
func (r *ChallengeRegistry) Select(dimensions []ChallengeDimension, count int) []ChallengeDriver {
	if count <= 0 {
		count = 1
	}

	type scored struct {
		driver ChallengeDriver
		score  int
	}
	var items []scored
	for _, d := range r.drivers {
		s := 0
		if len(dimensions) > 0 {
			driverDims := d.Dimensions()
			for _, dim := range dimensions {
				for _, dd := range driverDims {
					if dim == dd {
						s++
						break
					}
				}
			}
		} else {
			s = 1
		}
		items = append(items, scored{driver: d, score: s})
	}

	sort.Slice(items, func(i, j int) bool { return items[i].score > items[j].score })

	result := make([]ChallengeDriver, 0, count)
	for i := 0; i < count && i < len(items); i++ {
		result = append(result, items[i].driver)
	}
	return result
}
