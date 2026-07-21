package middleware

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestIDKey is the key used to store the request ID in context
type contextKey string
const RequestIDKey contextKey = "request_id"
const RequestIDHeader = "X-Request-ID"

// RequestID is a middleware that injects a Request-ID into the context
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		reqID := c.GetHeader(RequestIDHeader)
		if reqID == "" {
			reqID = uuid.New().String()
		}

		c.Set(string(RequestIDKey), reqID)
		c.Header(RequestIDHeader, reqID)

		// Inject into context.Context as well, so it can be used in downstream standard library calls
		ctx := context.WithValue(c.Request.Context(), RequestIDKey, reqID)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// GetRequestID extracts the request ID from the context
func GetRequestID(ctx context.Context) string {
	if reqID, ok := ctx.Value(RequestIDKey).(string); ok {
		return reqID
	}
	// gin.Context stores keys as strings, so let's try that too if ctx is a *gin.Context
	if ginCtx, ok := ctx.(*gin.Context); ok {
		return ginCtx.GetString(string(RequestIDKey))
	}
	return ""
}
