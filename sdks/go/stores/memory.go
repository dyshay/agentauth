package stores

import (
	"sync"
	"time"

	xagentauth "github.com/dyshay/agentauth/sdks/go"
)

type entry struct {
	data      *xagentauth.ChallengeData
	expiresAt int64
}

// MemoryStore is an in-memory ChallengeStore with TTL-based expiry.
type MemoryStore struct {
	mu      sync.RWMutex
	entries map[string]*entry
}

// NewMemoryStore creates a new MemoryStore.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{entries: make(map[string]*entry)}
}

// Set stores challenge data with a TTL in seconds.
func (s *MemoryStore) Set(id string, data *xagentauth.ChallengeData, ttlSeconds int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries[id] = &entry{
		data:      data,
		expiresAt: time.Now().UnixMilli() + ttlSeconds*1000,
	}
	return nil
}

// Get retrieves challenge data by ID, returning nil if not found or expired.
func (s *MemoryStore) Get(id string) (*xagentauth.ChallengeData, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	e, ok := s.entries[id]
	if !ok || time.Now().UnixMilli() > e.expiresAt {
		return nil, nil
	}
	return e.data, nil
}

// Delete removes challenge data by ID.
func (s *MemoryStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.entries, id)
	return nil
}
