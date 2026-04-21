@echo off
setlocal

echo Installing backend dependencies...
python -m pip install --user -r backend\requirements.txt || exit /b 1

echo Installing frontend dependencies...
cd frontend || exit /b 1
npm install || exit /b 1
cd ..

echo Setup complete.
