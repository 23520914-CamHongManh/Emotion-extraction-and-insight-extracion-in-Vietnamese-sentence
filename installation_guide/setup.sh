#!/bin/bash
# Quick Setup Script for Tennis AI Report
# Run this script to set up the entire project

echo "=== Tennis AI Report - Auto Setup ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js from https://nodejs.org"
    exit 1
fi
echo "✅ Node.js found: $(node --version)"

# Check Python
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "❌ Python not found. Please install Python from https://www.python.org"
    exit 1
fi
echo "✅ Python found: $(python --version 2>&1 || python3 --version)"

# Install Frontend Dependencies
echo ""
echo "📦 Installing Frontend Dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
echo "✅ Frontend dependencies installed"

# Create Virtual Environment
echo ""
echo "🐍 Creating Python Virtual Environment..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    python -m venv venv
    venv\Scripts\activate
else
    python3 -m venv venv
    source venv/bin/activate
fi
echo "✅ Virtual environment created"

# Install Python Dependencies
echo ""
echo "📦 Installing Python Dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Python dependencies"
        exit 1
    fi
    echo "✅ Python dependencies installed"
else
    echo "⚠️  requirements.txt not found. Skipping Python setup."
fi

echo ""
echo "=== ✅ Setup Complete! ==="
echo ""
echo "🚀 To start the application:"
echo ""
echo "Terminal 1 (Frontend):"
echo "  npm run dev"
echo ""
echo "Terminal 2 (Backend):"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "  venv\\Scripts\\activate"
else
    echo "  source venv/bin/activate"
fi
echo "  python api_server.py"
echo ""
echo "Then open: http://localhost:5173"
