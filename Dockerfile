# Stage 1: Build Go application
FROM golang:1.24-alpine AS builder-go

WORKDIR /app/server

COPY server/go.mod server/go.sum ./

RUN go mod download && go mod verify

COPY server/. .

RUN CGO_ENABLED=0 GOOS=linux go build -v -o /app/wikirego.exe -ldflags="-s -w" ./cmd/web/main.go

FROM node:24-alpine AS builder-client

WORKDIR /app/client

COPY client/package.json client/package-lock.json* ./

RUN npm install --frozen-lockfile

COPY client/. .

RUN npm run build

FROM alpine:latest

WORKDIR /app

COPY --from=builder-go /app/wikirego.exe .
COPY --from=builder-go /app/server/views ./views
COPY --from=builder-client /app/build/public ./public

EXPOSE 8080

ENTRYPOINT ["./wikirego.exe"]