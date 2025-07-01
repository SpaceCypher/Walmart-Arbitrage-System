#!/bin/bash

# AI Agent Setup Script
echo "Setting up AI Agents with CrewAI and Gemini..."

# Check if Python 3.8+ is installed
python_version=$(python3 --version 2>&1 | grep -Po '(?<=Python )\d+\.\d+')
if [[ $(echo "$python_version >= 3.8" | bc -l) -eq 0 ]]; then
    echo "Error: Python 3.8 or higher is required. Current version: $python_version"
    exit 1
fi

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv ai-agents-env
source ai-agents-env/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Check if Gemini API key is set
if [ -z "$GEMINI_API_KEY" ]; then
    echo ""
    echo "⚠️  IMPORTANT: Set your Gemini API key in the .env file"
    echo "   Get your API key from: https://makersuite.google.com/app/apikey"
    echo "   Add it to .env file: GEMINI_API_KEY=your_key_here"
    echo ""
fi

# Test installation
echo "Testing installation..."
python3 -c "
try:
    import crewai
    import google.generativeai as genai
    from pymongo import MongoClient
    import redis
    print('✅ All dependencies installed successfully!')
except ImportError as e:
    print(f'❌ Import error: {e}')
    exit(1)
"

echo ""
echo "🚀 AI Agent setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your Gemini API key to .env file"
echo "2. Start the AI agent API: python ai_agent_api.py"
echo "3. Or run a single cycle: python crew_orchestrator.py"
echo "4. For continuous operation: python crew_orchestrator.py continuous"
echo ""
