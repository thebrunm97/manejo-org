# ---- Build Stage ----
FROM golang:alpine AS builder

WORKDIR /app

# Cache dependencies first
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-w -s" -o /pmo-bot-go ./cmd/server

# ---- Runtime Stage ----
FROM gcr.io/distroless/static-debian12

# Environment variables for the bot
ENV TZ=America/Sao_Paulo

# Copy binary from builder
COPY --from=builder /pmo-bot-go /pmo-bot-go

EXPOSE 8080

ENTRYPOINT ["/pmo-bot-go"]
