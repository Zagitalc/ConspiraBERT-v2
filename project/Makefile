.PHONY: dev test docker-build docker-run

dev:
	uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

test:
	pytest -q

docker-build:
	docker build -t conspira-v2:latest .

docker-run:
	docker run --rm -it -p 8000:8000 --env-file .env conspira-v2:latest
