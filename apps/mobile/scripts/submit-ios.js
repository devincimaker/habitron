#!/usr/bin/env node
const { execSync } = require('child_process');

// Submit latest iOS build to App Store Connect
execSync('eas submit --platform ios --latest', { stdio: 'inherit' });
