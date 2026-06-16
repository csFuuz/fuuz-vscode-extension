#!/bin/bash

# Fuuz VS Code Extension Setup Script
# This script sets up the development environment for the Fuuz extension

set -e

echo "🚀 Setting up Fuuz VS Code Extension..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✓ Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✓ npm $(npm -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Compile TypeScript
echo ""
echo "🔨 Compiling TypeScript..."
npm run compile

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "1. Review the README.md for feature overview"
echo "2. Read CONFIG.md for configuration examples"
echo "3. Check DEVELOPMENT.md for development instructions"
echo ""
echo "🚀 To start development:"
echo "   npm run watch        # Watch TypeScript changes"
echo "   Press F5 in VS Code  # Launch extension in debug mode"
echo ""
echo "📋 To configure tenants:"
echo "   - Press Ctrl+, (or Cmd+,) to open VS Code settings"
echo "   - Search for 'fuuz' to find Fuuz settings"
echo "   - Add your enterprises and tenants following CONFIG.md examples"
echo ""
