#!/bin/bash
set -o errexit

pip install --upgrade pip setuptools wheel --no-cache-dir
pip install --only-binary :all: --no-cache-dir -r requirements.txt
pip install email-validator --no-cache-dir
