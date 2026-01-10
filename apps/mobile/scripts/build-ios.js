#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

// Increment build number
const oldBuild = app.expo.ios.buildNumber;
app.expo.ios.buildNumber = String(Number(oldBuild) + 1);

fs.writeFileSync(appJsonPath, JSON.stringify(app, null, 2) + '\n');
console.log(`Build number: ${oldBuild} → ${app.expo.ios.buildNumber}`);

// Run EAS build
execSync('eas build --platform ios --profile production', { stdio: 'inherit' });
