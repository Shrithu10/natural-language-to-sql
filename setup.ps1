# NL-to-SQL Setup Script (Windows PowerShell)
Write-Host "=== NL-to-SQL Setup ===" -ForegroundColor Cyan

# Backend
Write-Host "`n→ Setting up Python backend..." -ForegroundColor Yellow
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Set-Location ..

# Frontend
Write-Host "`n→ Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm install
Set-Location ..

# Ollama models
Write-Host "`n→ Pulling Ollama models (requires Ollama running)..." -ForegroundColor Yellow
ollama pull llama3   | Out-Host
ollama pull mistral  | Out-Host
# ollama pull sqlcoder | Out-Host  # large model, uncomment if needed

Write-Host "`n=== Setup complete! ===" -ForegroundColor Green
Write-Host "Backend:  cd backend; uvicorn main:app --reload --port 8000"
Write-Host "Frontend: cd frontend; npm run dev"
Write-Host "Open:     http://localhost:3000"
