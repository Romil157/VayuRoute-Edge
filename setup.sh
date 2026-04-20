#!/bin/bash
# setup.sh  --  VayuRoute Edge project setup for Linux and macOS
# Usage: bash setup.sh  (or chmod +x setup.sh && ./setup.sh)

set -e

echo "Setting up VayuRoute Edge..."

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

cd frontend
npm install
cd ..

echo "Setup complete. Run ./run.sh to start the system."
