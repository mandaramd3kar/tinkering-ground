#!/bin/bash

# Boardroom Skill - Installation Script
# This script installs the Boardroom skill for Claude Code

set -e

echo "🏛️  Boardroom AI Advisory Board - Installation"
echo "=============================================="
echo ""

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    SKILLS_DIR="$HOME/Library/Application Support/Claude/claude-code/skills"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    SKILLS_DIR="$HOME/.local/share/claude-code/skills"
else
    echo "❌ Unsupported OS: $OSTYPE"
    exit 1
fi

echo "📍 Detected OS: $OS"
echo "📁 Skills directory: $SKILLS_DIR"
echo ""

# Check if Claude Code is installed
if ! command -v claude-code &> /dev/null; then
    echo "⚠️  Claude Code not found. Please install Claude Code first:"
    echo "   https://docs.claude.com/en/docs/build-with-claude/claude-code"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create skills directory if it doesn't exist
if [ ! -d "$SKILLS_DIR" ]; then
    echo "📁 Creating skills directory..."
    mkdir -p "$SKILLS_DIR"
fi

# Determine installation method
echo "Choose installation method:"
echo "  1) Symlink (recommended - easier to update)"
echo "  2) Copy (standalone installation)"
echo ""
read -p "Enter choice (1 or 2): " -n 1 -r
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TARGET_DIR="$SKILLS_DIR/boardroom"

if [[ $REPLY =~ ^1$ ]]; then
    # Symlink method
    if [ -L "$TARGET_DIR" ]; then
        echo "⚠️  Existing symlink found. Removing..."
        rm "$TARGET_DIR"
    elif [ -d "$TARGET_DIR" ]; then
        echo "⚠️  Existing directory found. Removing..."
        rm -rf "$TARGET_DIR"
    fi
    
    echo "🔗 Creating symlink..."
    ln -s "$SCRIPT_DIR" "$TARGET_DIR"
    echo "✅ Symlink created: $TARGET_DIR -> $SCRIPT_DIR"
    
elif [[ $REPLY =~ ^2$ ]]; then
    # Copy method
    if [ -d "$TARGET_DIR" ]; then
        echo "⚠️  Existing installation found."
        read -p "Remove and reinstall? (y/N) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$TARGET_DIR"
        else
            echo "❌ Installation cancelled"
            exit 1
        fi
    fi
    
    echo "📦 Copying skill files..."
    cp -r "$SCRIPT_DIR" "$TARGET_DIR"
    echo "✅ Files copied to: $TARGET_DIR"
    
else
    echo "❌ Invalid choice"
    exit 1
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "Next steps:"
echo "1. Create a business-context.md file in your project directory"
echo "   Template: $TARGET_DIR/evals/files/business-context-template.md"
echo ""
echo "2. Start Claude Code and try your first decision:"
echo "   $ cd ~/your-project"
echo "   $ claude-code"
echo "   > /boardroom Should we [your strategic decision]?"
echo ""
echo "3. Read the full guide:"
echo "   $ cat $TARGET_DIR/README.md"
echo "   $ cat $TARGET_DIR/QUICKSTART.md"
echo ""
echo "Happy decision-making! 🚀"
