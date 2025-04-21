#!/usr/bin/env bash
set -e
STATE_FILE=".vibe.json"

echo "🚀 ViBe Setup Script"
OS="$(uname -s)"

clone_repo(){
  echo "📦 Cloning ViBe repository..."
  git clone https://github.com/continuousactivelearning/vibe.git
}
check_repo() {
  if ! command -v git &> /dev/null; then
  echo "Git is not installed."
  # install git and do git.config by gigving prompts"
  if [[ "$OS" == "Linux" ]]; then
    if command -v apt >/dev/null 2>&1; then
      sudo apt update
      sudo apt install -y git
    elif command -v dnf >/dev/null 2>&1; then
      sudo dnf install -y git
    elif command -v yum >/dev/null 2>&1; then
      sudo yum install -y git
    elif command -v pacman >/dev/null 2>&1; then
      sudo pacman -Sy --noconfirm git
    fi
  elif [[ "$OS" == "Darwin" ]]; then
    brew install git
  fi
  echo "Git installed successfully."
  fi
  cwd=$(pwd)
  if [[ "$cwd" == */vibe ]]; then
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      echo "This is a Git repository."
    else
      echo "No Git repository found."
      clone_repo
      cd vibe
    fi

  else
    echo "No Git repository found."
    clone_repo
    cd vibe
  fi
}

exists_node() {
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

install_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "📦 Installing pnpm..."
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL https://get.pnpm.io/install.sh | sh -
    else
      if command -v wget >/dev/null 2>&1; then
        wget -qO- https://get.pnpm.io/install.sh | sh -
      else
        echo "Installing curl..."
        if [[ "$OS" == "Linux" ]]; then
          if command -v apt >/dev/null 2>&1; then
            sudo apt update
            sudo apt install -y curl
          elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y curl
          elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y curl
          elif command -v pacman >/dev/null 2>&1; then
            sudo pacman -Sy --noconfirm curl
          fi
        elif [[ "$OS" == "Darwin" ]]; then
          brew install curl
        fi
        echo "Installing pnpm using curl..."
        curl -fsSL https://get.pnpm.io/install.sh | sh -
      fi
    fi
  fi
  pnpm setup
  SHELL_NAME=$(basename "$SHELL")
  case "$SHELL_NAME" in
  bash)
    source ~/.bashrc
    ;;
  zsh)
    source ~/.zshrc
    ;;
  fish)
    source ~/.config/fish/config.fish
    ;;
  *)
    echo "⚠️  Unknown shell. Please restart your terminal or manually source your shell config."
    ;;
  esac
  echo "✅ pnpm: $(pnpm -v)"
}

install_node_deps() {
  echo "📦 Installing required Node.js dependencies..."
  pnpm i -g tsx
  if ! command -v firebase >/dev/null 2>&1; then
    pnpm i -g firebase-tools
  fi
  pnpm i
}

install_cli() {
  echo "⚙ Installing CLI..."
  cd cli
  pnpm link --global
  cd ..
  echo "✅ Vibe CLI installed and linked globally."
}

init_state() {
  if [ ! -f "$STATE_FILE" ]; then
    echo "{}" >"$STATE_FILE"
    echo "📄 Created $STATE_FILE"
  fi
}

verify_node() {
  if exists_node; then
    echo "✅ Node.js found at version $(node -v)."
    current_node=$(node -v)
    required_node="v22.0.0"
    if ! [ "$(printf '%s\n' "${required_node#v}" "${current_node#v}" | sort -V | head -n1)" = "${required_node#v}" ]; then
      echo "❌ Node.js version is too old. Updating to v22.0.0 or higher."
      sudo pnpm install -g n
      sudo n latest
      export PATH="/usr/local/bin:$PATH"
      hash -r
      if [ $? -eq 0 ]; then
        echo "✅ Node.js updated to $(node -v)."
      else
        echo "❌ Failed to update Node.js. Please update it manually."
        exit 1
      fi
    fi
  else
    echo "Installing Node.js using pnpm..."
    sudo pnpm install -g n
    sudo n latest
    export PATH="/usr/local/bin:$PATH"
    hash -r
  fi
}

if [[ "$(pwd)" == */scripts ]]; then
  cd ..
fi

check_repo
install_pnpm
verify_node
install_node_deps
install_cli
init_state
vibe setup
echo "✅ Setup complete! You can now use 'vibe start'."
