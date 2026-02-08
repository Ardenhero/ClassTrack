#!/bin/bash

# Generate a secure random API secret (32 characters)
API_SECRET=$(openssl rand -base64 32)

echo "========================================="
echo "Generated API_SECRET for production:"
echo "========================================="
echo "$API_SECRET"
echo ""
echo "Add this to your .env.local file:"
echo "API_SECRET=$API_SECRET"
echo ""
echo "========================================="
echo "For production deployment, add this to:"
echo "- Vercel: Environment Variables section"
echo "- Railway: Variables tab"
echo "- Docker: docker-compose.yml or .env file"
echo "========================================="
