@echo off
echo Setting up VayuRoute Edge Project...
python -m venv venv
call venv\Scripts\activate
pip install -r backend\requirements.txt
cd frontend
npm install
cd ..
echo Setup Complete. You can now execute run.bat.
