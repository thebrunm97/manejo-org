package utils

import (
	"fmt"
	"time"
)

// RelativeTime formats a time.Time into a human-readable relative string.
func RelativeTime(t time.Time) string {
	d := time.Since(t)
	if d < time.Minute {
		return "agora"
	}
	if d < time.Hour {
		return fmt.Sprintf("há %d min", int(d.Minutes()))
	}
	if d < 24*time.Hour {
		return fmt.Sprintf("há %dh", int(d.Hours()))
	}
	return fmt.Sprintf("há %dd", int(d.Hours()/24))
}
