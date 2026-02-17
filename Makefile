.PHONY: install-web install-api dev-web dev-api

install-web:
	npm install --workspace @fidelis/web

install-api:
	pip3 install -r apps/api/requirements.txt

dev-web:
	npm run dev:web

dev-api:
	npm run dev:api
