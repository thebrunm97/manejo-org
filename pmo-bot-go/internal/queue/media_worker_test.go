package queue

import (
	"context"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

func TestMediaWorker_ProcessAudio_WrongMediaType(t *testing.T) {
	worker := NewMediaWorker(MediaWorkerConfig{})

	// Simulate a job that is NOT audio, NOT image, but has empty body (e.g. video, document)
	job := &Job{
		ID: "job-1",
		RawPayload: ports.IncomingMessage{
			IsAudio: false,
			IsImage: false,
			Body:    "", // Empty body for a media message
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// If we call processMedia directly
	_, _, err := worker.processMedia(ctx, job)
	
	if err == nil {
		t.Fatal("expected error for unsupported media type, got nil")
	}

	// It should return ErrUnsupportedMediaType or something similar.
	// We'll map "text message with empty body" or create a specific error.
	if err.Error() != "unsupported media type" {
		// In the current implementation it returns "text message with empty body".
		// We'll need to modify the implementation to return ErrUnsupportedMediaType
		// Let's assert against the new expected error.
		t.Errorf("expected 'unsupported media type', got %v", err)
	}
}
