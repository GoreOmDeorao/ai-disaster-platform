FROM golang:1.21-alpine AS build
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /disaster-api ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /disaster-api ./disaster-api
EXPOSE 8080
ENTRYPOINT ["/app/disaster-api"]
