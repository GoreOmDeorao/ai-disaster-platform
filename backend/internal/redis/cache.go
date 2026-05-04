package redis

import (
	"context"
	"log"
	"time"

	"github.com/go-redis/redis/v8"
)

func NewClient(url string) *redis.Client {
	if url == "" {
		url = "redis://127.0.0.1:6379/0"
		log.Println("ℹ️  REDIS_URL not set, using redis://127.0.0.1:6379/0")
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		log.Fatalf("❌ Redis URL parse error: %v", err)
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("❌ Redis ping failed: %v", err)
	}
	return rdb
}

func Set(rdb *redis.Client, key, value string, ttl time.Duration) error {
	return rdb.Set(context.Background(), key, value, ttl).Err()
}

func Get(rdb *redis.Client, key string) (string, bool) {
	val, err := rdb.Get(context.Background(), key).Result()
	if err == redis.Nil {
		return "", false
	}
	if err != nil {
		return "", false
	}
	return val, true
}
