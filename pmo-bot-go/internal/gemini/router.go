package gemini

// router.go — Backward compatibility shim.
//
// The ClassifyIntent logic has been consolidated into the LLMProvider interface
// implementation in client.go. This file is kept for any router-specific helpers
// that may be needed in the future, but the core classification function is now
// accessible via the llm.LLMProvider.ClassifyIntent method.
//
// The routerSystemPrompt has been moved to internal/prompt/manager.go as
// prompt.RouterSystemPrompt(), making it provider-agnostic.
