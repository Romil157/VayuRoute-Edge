#!/bin/bash
set -e

python3 -m pip install --user -r backend/requirements.txt

cd frontend
npm install
cd ..

echo "Setup complete."
