#!/usr/bin/env bash
set -e
STATE_FILE=".vibe.json"

echo "🚀 ViBe Setup Script"
OS="$(uname -s)"


# boolian wasclones true or false

WASCLONED=false
clone_repo() {
  echo "📦 Cloning ViBe repository..."
  git clone https://github.com/continuousactivelearning/vibe.git
  if [ $? -ne 0 ]; then
    echo "❌ Failed to clone the repository."
    exit 1
  fi
  WASCLONED=true
  cd vibe

}
check_repo() {
  if ! command -v git &>/dev/null; then
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
    fi

  else
    echo "No Git repository found."
    clone_repo
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
  source "$HOME/.bashrc" || source "$HOME/.zshrc" || source "$HOME/.config/fish/config.fish"
  if [ $? -ne 0 ]; then
    echo "❌ Failed to install pnpm."
    exit 1
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "Restart the setup."
    exit 1
	else
  		echo "✅ pnpm: $(pnpm -v)"
  fi
}

install_node_deps() {
  echo "📦 Installing required Node.js dependencies..."
  pnpm i -g tsx
  if ! command -v firebase >/dev/null 2>&1; then
    pnpm i -g firebase-tools
  fi
  sudo chown -R "$USER":"$USER" ./
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
    required_node="v23.0.0"
    if ! [ "$(printf '%s\n' "${required_node#v}" "${current_node#v}" | sort -V | head -n1)" = "${required_node#v}" ]; then
      echo "❌ Node.js version is too old. Updating to v22.0.0 or higher."
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
      # in lieu of restarting the shell
      \. "$HOME/.nvm/nvm.sh"
      # Download and install Node.js:
      nvm install 23
      source "$HOME/.bashrc" || source "$HOME/.zshrc" || source "$HOME/.config/fish/config.fish"
      if [ $? -eq 0 ]; then
        echo "✅ Node.js updated to $(node -v)."
      else
        echo "❌ Failed to update Node.js. Please update it manually."
        exit 1
      fi
    fi
  else
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
    # in lieu of restarting the shell
    \. "$HOME/.nvm/nvm.sh"
    # Download and install Node.js:
    nvm install 23
    source ~/.bashrc || source ~/.zshrc || source ~/.config/fish/config.fish
  fi
}

source ~/.bashrc || source ~/.zshrc || source ~/.config/fish/config.fish
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
if [ "$WASCLONED" = true ]; then
  echo "Do 'cd vibe' to enter the directory."
fi
if ! command -v vibe >/dev/null 2>&1; then
echo "✅ Setup complete! To use CLI restart the terminal or source the rc file."
else
  echo "To use CLI, run 'vibe' command."
fi