package tts_test

import (
	"context"
	"errors"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
)

// Mocks

type mockCache struct {
	audio ports.AudioArtifact
	err   error
}

func (m *mockCache) Get(ctx context.Context, key string) (ports.AudioArtifact, error) {
	return m.audio, m.err
}

type mockSynthesizer struct {
	audio ports.AudioArtifact
	err   error
	calls int
}

func (m *mockSynthesizer) Synthesize(ctx context.Context, req ports.SynthesisRequest) (ports.AudioArtifact, error) {
	m.calls++
	return m.audio, m.err
}

func TestRouter(t *testing.T) {
	t.Run("1. Cache hit -> não chama Local nem Cloud", func(t *testing.T) {
		cache := &mockCache{
			audio: ports.AudioArtifact{Data: []byte("cache_audio")},
			err:   nil,
		}
		local := &mockSynthesizer{}
		cloud := &mockSynthesizer{}

		router := tts.NewRouter(cache, local, cloud)
		req := ports.SynthesisRequest{CacheKey: "hit_me"}

		art, err := router.Synthesize(context.Background(), req)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if art.Source != "cache" {
			t.Errorf("expected source 'cache', got %s", art.Source)
		}
		if local.calls != 0 || cloud.calls != 0 {
			t.Errorf("expected 0 calls to local/cloud, got local=%d cloud=%d", local.calls, cloud.calls)
		}
	})

	t.Run("2. Cache miss, não sensível, Local disponível -> não chama Cloud", func(t *testing.T) {
		cache := &mockCache{err: tts.ErrCacheMiss}
		local := &mockSynthesizer{
			audio: ports.AudioArtifact{Data: []byte("local_audio")},
			err:   nil,
		}
		cloud := &mockSynthesizer{}

		router := tts.NewRouter(cache, local, cloud)
		req := ports.SynthesisRequest{Sensitive: false, CacheKey: "miss_me"}

		art, err := router.Synthesize(context.Background(), req)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if art.Source != "local" {
			t.Errorf("expected source 'local', got %s", art.Source)
		}
		if local.calls != 1 {
			t.Errorf("expected 1 call to local, got %d", local.calls)
		}
		if cloud.calls != 0 {
			t.Errorf("expected 0 calls to cloud, got %d", cloud.calls)
		}
	})

	t.Run("3. Sensível + Local indisponível/saturado -> nunca chama Cloud", func(t *testing.T) {
		cache := &mockCache{err: tts.ErrCacheMiss}
		localErr := errors.New("local saturated")
		local := &mockSynthesizer{
			err: localErr,
		}
		cloud := &mockSynthesizer{
			audio: ports.AudioArtifact{Data: []byte("cloud_audio")},
			err:   nil,
		}

		router := tts.NewRouter(cache, local, cloud)
		req := ports.SynthesisRequest{Sensitive: true, CacheKey: "sensitive"}

		_, err := router.Synthesize(context.Background(), req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, localErr) {
			t.Errorf("expected local error %v, got %v", localErr, err)
		}
		if cloud.calls != 0 {
			t.Errorf("CRITICAL FALLBACK LEAK: expected 0 calls to cloud on sensitive request, got %d", cloud.calls)
		}
	})

	t.Run("4. Cache miss, não sensível, Local saturado -> cai para Cloud", func(t *testing.T) {
		cache := &mockCache{err: tts.ErrCacheMiss}
		local := &mockSynthesizer{
			err: errors.New("local saturated"),
		}
		cloud := &mockSynthesizer{
			audio: ports.AudioArtifact{Data: []byte("cloud_audio")},
			err:   nil,
		}

		router := tts.NewRouter(cache, local, cloud)
		req := ports.SynthesisRequest{Sensitive: false, CacheKey: "miss"}

		art, err := router.Synthesize(context.Background(), req)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if art.Source != "cloud" {
			t.Errorf("expected source 'cloud', got %s", art.Source)
		}
		if local.calls != 1 {
			t.Errorf("expected 1 call to local, got %d", local.calls)
		}
		if cloud.calls != 1 {
			t.Errorf("expected 1 call to cloud, got %d", cloud.calls)
		}
	})
}
