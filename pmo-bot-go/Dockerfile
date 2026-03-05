# ---- Build Stage ----
FROM golang:alpine AS builder

WORKDIR /app

# Cache dependencies first
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /pmo-bot-go ./cmd/server

# ---- Runtime Stage ----
FROM alpine:3.21

# CA certificates for HTTPS calls and tzdata for Brazil Timezone
RUN apk --no-cache add ca-certificates tzdata
ENV TZ=America/Sao_Paulo

COPY --from=builder /pmo-bot-go /pmo-bot-go

EXPOSE 8080

ENTRYPOINT ["/pmo-bot-go"]
