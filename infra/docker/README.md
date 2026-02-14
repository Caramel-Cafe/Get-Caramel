# Docker Build Assets

This folder contains reusable Docker build assets for backend services.

## Build One Service
```bash
docker build -f infra/docker/Dockerfile.service \
  --build-arg PACKAGE_NAME=@get-caramel/auth-service \
  --build-arg SERVICE_PATH=services/auth-service \
  -t ghcr.io/get-caramel/auth-service:local .
```

## Build and Push All Backend Services
```bash
RELEASE_SHA=<git-sha> IMAGE_REGISTRY=ghcr.io/get-caramel bash ops/release/build-images.sh
```
