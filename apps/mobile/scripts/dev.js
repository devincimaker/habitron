#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const appRoot = resolve(__dirname, '..');
const env = { ...process.env };
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const bundleIdentifier = 'com.capybarastudios.habitscoach';

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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    env,
    encoding: 'utf8',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function getSimulatorUdid(simulatorName) {
  const result = run('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || 'Unable to list available simulators.');
  }

  const devicesByRuntime = JSON.parse(result.stdout).devices;
  const allDevices = Object.values(devicesByRuntime).flat();
  const exactMatch = allDevices.find((device) => device.isAvailable && device.name === simulatorName);

  if (!exactMatch) {
    const availableNames = allDevices
      .filter((device) => device.isAvailable)
      .map((device) => device.name)
      .sort();
    const uniqueNames = [...new Set(availableNames)];
    throw new Error(
      `Configured simulator "${simulatorName}" was not found. Available simulators: ${uniqueNames.join(', ')}`
    );
  }

  return exactMatch.udid;
}

function ensureSimulatorBooted(udid) {
  run('xcrun', ['simctl', 'boot', udid], { stdio: 'ignore' });
  run('open', ['-a', 'Simulator'], { stdio: 'ignore' });
}

function isDevClientInstalled(udid) {
  const result = run('xcrun', ['simctl', 'get_app_container', udid, bundleIdentifier, 'app'], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function installDevClient(simulatorName) {
  const result = run(npxCommand, ['expo', 'run:ios', '--device', simulatorName, '--no-bundler'], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function openDevClient(udid, port) {
  const url = `exp+habits-coach://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${port}`;
  const result = run('xcrun', ['simctl', 'openurl', udid, url], { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error('Failed to open the Expo development client on the simulator.');
  }
}

loadEnvFile(resolve(appRoot, '.env'));

const simulator = env.IOS_SIMULATOR || 'iPhone 16e';
const port = env.EXPO_PORT || '8081';
env.IOS_SIMULATOR_DEVICE = simulator;

console.log(`Starting Expo on port ${port} with simulator: ${simulator}`);

let udid;

try {
  udid = getSimulatorUdid(simulator);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

ensureSimulatorBooted(udid);

if (!isDevClientInstalled(udid)) {
  console.log(`Installing development build for ${simulator}...`);
  installDevClient(simulator);
}

const metro = spawn(npxCommand, ['expo', 'start', '--port', port], {
  cwd: appRoot,
  env,
  stdio: 'inherit',
});

const launchTimer = setTimeout(() => openDevClient(udid, port), 5000);

metro.on('exit', (code) => {
  clearTimeout(launchTimer);
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  clearTimeout(launchTimer);
  metro.kill('SIGINT');
});

process.on('SIGTERM', () => {
  clearTimeout(launchTimer);
  metro.kill('SIGTERM');
});
