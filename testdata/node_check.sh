#!/bin/bash
echo "=== node in host ==="
node --version 2>&1 || echo "no node"
echo "=== npm ==="
npm --version 2>&1 || echo "no npm"