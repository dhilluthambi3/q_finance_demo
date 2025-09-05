# This PowerShell script starts the React frontend, Flask backend, and Celery worker in separate terminal windows.

# --- Start Frontend (in a new PowerShell window) ---
Write-Host "Starting frontend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '.\frontend'; npm run dev"

# --- Start Flask Backend (in a new CMD window) ---
Write-Host "Starting Flask backend..."
# We use 'cmd /k' to ensure the virtual environment activation persists for the next command.
# The '&&' operator ensures the next command only runs if the previous one was successful.
Start-Process cmd -ArgumentList "/k", "cd .\backend && .\.venv\Scripts\activate && flask --app app.py run --debug --port 8000"

# --- Start Celery Worker (in a new CMD window) ---
Write-Host "Starting Celery worker..."
Start-Process cmd -ArgumentList "/k", "cd .\backend && .\.venv\Scripts\activate && celery -A tasks.celery_app worker --pool=solo --loglevel=INFO"

Write-Host "All processes have been launched. Check the new windows for output."
