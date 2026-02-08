#!/bin/bash
echo "Deploying changes..."
cd /Users/heroo/Downloads/ClassTrack-main
git add .
git commit -m "Fix: Show time_out even for invalid sessions"
git push
echo "Deployment triggered! Check your dashboard for build status."
