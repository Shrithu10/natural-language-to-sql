#!/usr/bin/env bash
set -e

echo "=== NL-to-SQL Setup ==="

# ── Backend ──────────────────────────────────────────────
echo ""
echo "→ Setting up Python backend..."
cd backend
python -m venv .venv
source .venv/Scripts/activate 2>/dev/null || source .venv/bin/activate
pip install -r requirements.txt
cd ..

# ── Frontend ──────────────────────────────────────────────
echo ""
echo "→ Installing frontend dependencies..."
cd frontend
npm install
cd ..

# ── Ollama models ─────────────────────────────────────────
echo ""
echo "→ Pulling Ollama models (requires Ollama running)..."
ollama pull llama3      || echo "  llama3 pull failed — run manually: ollama pull llama3"
ollama pull mistral     || echo "  mistral pull failed — run manually: ollama pull mistral"
ollama pull sqlcoder    || echo "  sqlcoder pull failed — run manually: ollama pull sqlcoder"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start backend:   cd backend && uvicorn main:app --reload --port 8000"
echo "Start frontend:  cd frontend && npm run dev"
echo "Open:            http://localhost:3000"
