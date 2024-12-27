#!/bin/bash

ERD_OUT_FILE="erd.png"

function generate_er_diagram() {
    python manage.py graph_models --all -g --color-code-deletions --output=$ERD_OUT_FILE
}

function lint_code() {
    flake8 .
}

function lint_code_fix() {
    black .
    flake8 .
}

function run_server() {
    python manage.py migrate
    python manage.py runserver
}

case "$1" in
    doc)
        generate_er_diagram
        echo "ERD generated at $ERD_OUT_FILE"
        ;;
    lint)
        lint_code
        ;;
    lint:fix)
        lint_code_fix
        ;;
    run)
        run_server
        ;;
    *)
        echo "Usage: $0 {doc|lint|lint:fix|run}"
        ;;
esac
