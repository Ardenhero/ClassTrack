#!/bin/bash
# scripts/smoke-test.sh

# Use first argument as domain or default to localhost
DOMAIN="${1:-http://localhost:3000}"

echo "Running smoke tests against: $DOMAIN"

# 1. Health Check
echo -n "Checking /api/health... "
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/health")
if [ "$CODE" -eq 200 ]; then echo "OK"; else echo "FAILED ($CODE)"; exit 1; fi

# 2. Homepage (Public)
echo -n "Checking / (Home)... "
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/")
if [ "$CODE" -eq 200 ] || [ "$CODE" -eq 307 ]; then echo "OK"; else echo "FAILED ($CODE)"; exit 1; fi
# Note: Home might redirect to login (307) or dashboard

# 3. Login Page
echo -n "Checking /login... "
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/login")
if [ "$CODE" -eq 200 ]; then echo "OK"; else echo "FAILED ($CODE)"; exit 1; fi

echo "All smoke tests passed!"
