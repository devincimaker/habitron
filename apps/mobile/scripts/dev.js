#!/usr/bin/env node
const { spawn } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

// Load .env files (later files override earlier ones)
const env = { ...process.env };

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) env[key] = value;
  }
}

loadEnvFile(resolve(__dirname, '..', '.env'));

const simulator = env.IOS_SIMULATOR || 'iPhone 16 Plus';
const port = env.EXPO_PORT || '8081';

console.log(`Starting Expo on port ${port} with simulator: ${simulator}`);

// Set simulator via environment variable (Expo's supported method)
env.IOS_SIMULATOR_DEVICE = simulator;

const args = ['start', '--ios', '--port', port];

const child = spawn('expo', args, {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('exit', (code) => process.exit(code));
