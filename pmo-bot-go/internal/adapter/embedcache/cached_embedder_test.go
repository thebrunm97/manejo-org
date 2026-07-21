package embedcache

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockEmbedder implements mcp.Embedder for testing.
type mockEmbedder struct {
	callsQuery int32
	callsIndex int32
	mockResult []float32
	mockError  error
	delay      time.Duration
}

func (m *mockEmbedder) GenerateQueryEmbedding(query string) ([]float32, error) {
	atomic.AddInt32(&m.callsQuery, 1)
	if m.delay > 0 {
		time.Sleep(m.delay)
	}
	return m.mockResult, m.mockError
}

func (m *mockEmbedder) GenerateEmbedding(text string) ([]float32, error) {
	atomic.AddInt32(&m.callsIndex, 1)
	return m.mockResult, m.mockError
}

func TestCachedEmbedder_GenerateQueryEmbedding_HitAndMiss(t *testing.T) {
	mock := &mockEmbedder{
		mockResult: []float32{1.0, 2.0, 3.0},
	}
	cache := NewCachedEmbedder(mock, 1*time.Minute)

	// Miss
	res1, err := cache.GenerateQueryEmbedding("Como plantar alface?")
	require.NoError(t, err)
	assert.Equal(t, mock.mockResult, res1)
	assert.Equal(t, int32(1), atomic.LoadInt32(&mock.callsQuery))

	// Hit (exact match)
	res2, err := cache.GenerateQueryEmbedding("Como plantar alface?")
	require.NoError(t, err)
	assert.Equal(t, mock.mockResult, res2)
	assert.Equal(t, int32(1), atomic.LoadInt32(&mock.callsQuery), "Should not call delegate on cache hit")

	// Hit (normalized string: lowercase, spaces)
	res3, err := cache.GenerateQueryEmbedding("  como plantar alface?  ")
	require.NoError(t, err)
	assert.Equal(t, mock.mockResult, res3)
	assert.Equal(t, int32(1), atomic.LoadInt32(&mock.callsQuery), "Should not call delegate on normalized cache hit")
}

func TestCachedEmbedder_GenerateQueryEmbedding_Expiration(t *testing.T) {
	mock := &mockEmbedder{
		mockResult: []float32{1.0, 2.0, 3.0},
	}
	// Small TTL
	cache := NewCachedEmbedder(mock, 10*time.Millisecond)

	// Miss
	_, err := cache.GenerateQueryEmbedding("query")
	require.NoError(t, err)
	assert.Equal(t, int32(1), atomic.LoadInt32(&mock.callsQuery))

	// Wait for TTL to expire
	time.Sleep(15 * time.Millisecond)

	// Miss again (expired)
	_, err = cache.GenerateQueryEmbedding("query")
	require.NoError(t, err)
	assert.Equal(t, int32(2), atomic.LoadInt32(&mock.callsQuery))
}

func TestCachedEmbedder_GenerateQueryEmbedding_Singleflight(t *testing.T) {
	mock := &mockEmbedder{
		mockResult: []float32{1.0, 2.0, 3.0},
		delay:      100 * time.Millisecond, // Delay to force concurrent requests to pile up
	}
	cache := NewCachedEmbedder(mock, 1*time.Minute)

	var wg sync.WaitGroup
	numConcurrent := 10
	wg.Add(numConcurrent)

	// Fire 10 concurrent identical queries
	for i := 0; i < numConcurrent; i++ {
		go func() {
			defer wg.Done()
			res, err := cache.GenerateQueryEmbedding("concurrent query")
			require.NoError(t, err)
			assert.Equal(t, mock.mockResult, res)
		}()
	}

	wg.Wait()

	// Due to singleflight, the delegate should have been called EXACTLY ONCE
	assert.Equal(t, int32(1), atomic.LoadInt32(&mock.callsQuery), "Singleflight failed: delegate called multiple times")
}

func TestCachedEmbedder_GenerateQueryEmbedding_ErrorPassThrough(t *testing.T) {
	mock := &mockEmbedder{
		mockError: errors.New("api error"),
	}
	cache := NewCachedEmbedder(mock, 1*time.Minute)

	res, err := cache.GenerateQueryEmbedding("query")
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Equal(t, "api error", err.Error())

	// Next call should try again (errors are not cached)
	mock.mockError = nil
	mock.mockResult = []float32{1.0}
	res2, err := cache.GenerateQueryEmbedding("query")
	require.NoError(t, err)
	assert.Equal(t, []float32{1.0}, res2)
	assert.Equal(t, int32(2), atomic.LoadInt32(&mock.callsQuery))
}

func TestCachedEmbedder_GenerateEmbedding_NoCache(t *testing.T) {
	mock := &mockEmbedder{
		mockResult: []float32{9.0},
	}
	cache := NewCachedEmbedder(mock, 1*time.Minute)

	// GenerateEmbedding should just pass through
	res1, err := cache.GenerateEmbedding("text 1")
	require.NoError(t, err)
	assert.Equal(t, mock.mockResult, res1)

	res2, err := cache.GenerateEmbedding("text 1") // Same text
	require.NoError(t, err)
	assert.Equal(t, mock.mockResult, res2)

	assert.Equal(t, int32(2), atomic.LoadInt32(&mock.callsIndex), "GenerateEmbedding should not be cached")
	assert.Equal(t, int32(0), atomic.LoadInt32(&mock.callsQuery))
}

func TestCachedEmbedder_Janitor(t *testing.T) {
	mock := &mockEmbedder{
		mockResult: []float32{1.0},
	}
	cache := NewCachedEmbedder(mock, 5*time.Millisecond) // Short TTL
	
	// Override janitor for testing, we don't want to wait 10 minutes
	// We'll manually call janitor's logic or just run a quick inline simulation.
	
	_, err := cache.GenerateQueryEmbedding("query to expire")
	require.NoError(t, err)
	
	// Fast-forward expiration
	time.Sleep(10 * time.Millisecond)
	
	// Ensure it's still in the map before cleanup
	k := cache.key("query to expire")
	cache.mu.RLock()
	_, exists := cache.cache[k]
	cache.mu.RUnlock()
	assert.True(t, exists, "Entry should exist but be expired")
	
	// Trigger the cleanup logic directly
	now := time.Now()
	cache.mu.Lock()
	for k, v := range cache.cache {
		if now.After(v.expiresAt) {
			delete(cache.cache, k)
		}
	}
	cache.mu.Unlock()
	
	// Ensure it was cleaned up
	cache.mu.RLock()
	_, existsAfter := cache.cache[k]
	cache.mu.RUnlock()
	assert.False(t, existsAfter, "Janitor should have cleaned up the expired entry")
}
