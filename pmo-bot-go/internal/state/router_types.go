package state

import (
	"errors"
	"time"
)

type Intent string

const (
	IntentAgronomy      Intent = "AGRONOMY"
	IntentDatabase      Intent = "DATABASE"
	IntentChat          Intent = "CHAT"
	IntentClarification Intent = "CLARIFICATION"
	IntentScheduling    Intent = "SCHEDULING"
	IntentWorkflow      Intent = "WORKFLOW"
)

type WriteScope string

const (
	WriteScopeFarmRecord WriteScope = "farm_record"
	WriteScopePlot       WriteScope = "plot"
	WriteScopeHarvest    WriteScope = "harvest"
	WriteScopeNone       WriteScope = "none"
)

type ConfidenceCalibration string

const (
	ConfidenceWellCalibrated ConfidenceCalibration = "well_calibrated"
	ConfidenceUnderconfident ConfidenceCalibration = "underconfident"
	ConfidenceOverconfident  ConfidenceCalibration = "overconfident"
	ConfidenceUnknown        ConfidenceCalibration = "unknown"
)

type DebugMeta struct {
	RouteSource  string   `json:"route_source"`
	RulesMatched []string `json:"rules_matched"`
	Explain      string   `json:"explain"`
}

type RouterResult struct {
	PrimaryIntent         Intent
	SecondaryIntent       *Intent
	Confidence            float64
	ConfidenceCalibration ConfidenceCalibration
	NeedsWrite            bool
	WriteScope            WriteScope
	IsMixed               bool
	DebugMeta             DebugMeta
	RawResponse           string
	Timestamp             time.Time
}

func (r RouterResult) Validate() error {
	if r.Confidence < 0.0 || r.Confidence > 1.0 {
		return errors.New("Confidence deve estar entre 0.0 e 1.0")
	}
	if r.IsMixed && r.SecondaryIntent == nil {
		return errors.New("se IsMixed == true, então SecondaryIntent != nil")
	}
	if r.NeedsWrite && r.WriteScope == WriteScopeNone {
		return errors.New("se NeedsWrite == true, então WriteScope != none")
	}
	return nil
}
