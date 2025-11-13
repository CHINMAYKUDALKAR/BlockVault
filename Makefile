PY=python
VENV=.venv
PIP=$(VENV)/bin/pip
PYTHON=$(VENV)/bin/python

.PHONY: help venv install dev run run-mem test lint format clean db-setup db-init db-backup db-restore db-health db-stats docker-up docker-down docker-logs

help:
	@echo "Targets:"
	@echo "  venv        - create virtual environment"
	@echo "  install     - install runtime dependencies"
	@echo "  dev         - install dev dependencies (editable)"
	@echo "  run         - run app with current .env"
	@echo "  run-mem     - run app with in-memory DB"
	@echo "  run-stable  - run app (no reloader) stable single process"
	@echo "  test        - run pytest"
	@echo "  lint        - run flake8 and mypy"
	@echo "  format      - run black"
	@echo "  clean       - remove venv and caches"
	@echo ""
	@echo "Database Commands:"
	@echo "  db-setup    - interactive database setup"
	@echo "  db-init     - initialize database with indexes"
	@echo "  db-backup   - create database backup"
	@echo "  db-restore  - restore from backup (interactive)"
	@echo "  db-health   - check database health"
	@echo "  db-stats    - show database statistics"
	@echo ""
	@echo "Docker Commands:"
	@echo "  docker-up   - start Docker services"
	@echo "  docker-down - stop Docker services"
	@echo "  docker-logs - view Docker logs"

venv:
	@test -d $(VENV) || $(PY) -m venv $(VENV)

install: venv
	$(PIP) install -r requirements.txt

dev: venv
	$(PIP) install -e .[dev]

run: venv
	$(PYTHON) app.py

run-mem: venv
	MONGO_URI=memory://dev $(PYTHON) app.py

run-stable: venv
	$(PYTHON) scripts/run_backend.py

test: venv
	$(PYTHON) -m pytest -q

lint: venv
	$(VENV)/bin/flake8 blockvault
	$(VENV)/bin/mypy blockvault || true

format: venv
	$(VENV)/bin/black blockvault tests

clean:
	rm -rf $(VENV) .pytest_cache *.egg-info
	find . -name '__pycache__' -type d -exec rm -rf {} +

# Database Commands
db-setup:
	@./scripts/setup_database.sh

db-init: venv
	@$(PYTHON) blockvault/core/db_init.py $${MONGO_URI:-mongodb://localhost:27017/blockvault}

db-backup:
	@./scripts/db_backup.sh

db-restore:
	@./scripts/db_restore.sh --list

db-health: venv
	@$(PYTHON) blockvault/core/db_init.py $${MONGO_URI:-mongodb://localhost:27017/blockvault} --health

db-stats: venv
	@$(PYTHON) blockvault/core/db_init.py $${MONGO_URI:-mongodb://localhost:27017/blockvault} --stats

# Docker Commands
docker-up:
	@docker-compose -f docker-compose.prod.yml up -d
	@echo "Services starting... Wait a few seconds for MongoDB to be ready"
	@sleep 5
	@docker-compose -f docker-compose.prod.yml ps

docker-down:
	@docker-compose -f docker-compose.prod.yml down

docker-logs:
	@docker-compose -f docker-compose.prod.yml logs -f
