#!/usr/bin/env node
const { spawn } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

// Load .env.local if it exists
const envPath = resolve(__dirname, '..', '.env.local');
const env = { ...process.env };

if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length > 0) {
        env[key.trim()] = rest.join('=').trim();
      }
    }
  }
}

const simulator = env.IOS_SIMULATOR || 'iPhone 16 Plus';
const port = env.EXPO_PORT || '8081';

console.log(`Starting Expo on port ${port} with simulator: ${simulator}`);

const args = ['start', '--go', '--port', port, '--ios-simulator', simulator];

const child = spawn('expo', args, {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('exit', (code) => process.exit(code));
