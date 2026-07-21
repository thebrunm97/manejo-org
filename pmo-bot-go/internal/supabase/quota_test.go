package supabase

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCheckSaldo_BonusCredits(t *testing.T) {
	now := time.Now().UTC()
	future := now.Add(24 * time.Hour)
	past := now.Add(-24 * time.Hour)

	tests := []struct {
		name              string
		planTier          string
		dailyRequestCount int
		lastUsageDate     string
		bonusCredits      int
		bonusExpiresAt    *time.Time
		expectedLimit     int
	}{
		{
			name:              "Standard Free User No Bonus",
			planTier:          "free",
			dailyRequestCount: 10,
			lastUsageDate:     now.Format("2006-01-02"),
			bonusCredits:      0,
			bonusExpiresAt:    nil,
			expectedLimit:     100,
		},
		{
			name:              "Premium User",
			planTier:          "premium",
			dailyRequestCount: 10,
			lastUsageDate:     now.Format("2006-01-02"),
			bonusCredits:      0,
			bonusExpiresAt:    nil,
			expectedLimit:     99999,
		},
		{
			name:              "Active Bonus Credits",
			planTier:          "free",
			dailyRequestCount: 10,
			lastUsageDate:     now.Format("2006-01-02"),
			bonusCredits:      50,
			bonusExpiresAt:    &future,
			expectedLimit:     150,
		},
		{
			name:              "Expired Bonus Credits",
			planTier:          "free",
			dailyRequestCount: 10,
			lastUsageDate:     now.Format("2006-01-02"),
			bonusCredits:      50,
			bonusExpiresAt:    &past,
			expectedLimit:     100,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create mock server
			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if !strings.Contains(r.URL.Path, "/rest/v1/profiles") {
					w.WriteHeader(http.StatusNotFound)
					return
				}

				// Build mock profile response
				profileRecord := map[string]interface{}{
					"plan_tier":           tc.planTier,
					"daily_request_count": tc.dailyRequestCount,
					"last_usage_date":     tc.lastUsageDate,
					"bonus_credits":       tc.bonusCredits,
				}
				if tc.bonusExpiresAt != nil {
					profileRecord["bonus_expires_at"] = tc.bonusExpiresAt.Format(time.RFC3339Nano)
				} else {
					profileRecord["bonus_expires_at"] = nil
				}

				responseBytes, _ := json.Marshal([]interface{}{profileRecord})
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				w.Write(responseBytes)
			}))
			defer ts.Close()

			client, err := NewClient(Config{
				URL: ts.URL,
				Key: "test-key",
			})
			if err != nil {
				t.Fatalf("failed to create client: %v", err)
			}

			count, limit, err := client.CheckSaldo("test-profile-id")
			if err != nil {
				t.Fatalf("CheckSaldo failed: %v", err)
			}

			if count != tc.dailyRequestCount {
				t.Errorf("expected count %d, got %d", tc.dailyRequestCount, count)
			}
			if limit != tc.expectedLimit {
				t.Errorf("expected limit %d, got %d", tc.expectedLimit, limit)
			}
		})
	}
}
