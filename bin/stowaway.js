#!/usr/bin/env node
'use strict';

const path = require('path');
const { exec } = require('child_process');

const APP_PORT = parseInt(process.env.STOWAWAY_PORT || '3747', 10);
const API_PORT = APP_PORT + 1;

const { startAppServer } = require('../server/app');
const { startApiServer } = require('../server/api');

async function main() {
  console.log('\n⚓  Stowaway starting…\n');

  try {
    await Promise.all([
      startAppServer(APP_PORT),
      startApiServer(API_PORT, APP_PORT),
    ]);
  } catch (e) {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n  Port ${e.port || APP_PORT} is already in use.\n  Try: STOWAWAY_PORT=3750 stowaway\n`);
    } else {
      console.error('\n  Failed to start:', e.message, '\n');
    }
    process.exit(1);
  }

  const url = `http://localhost:${APP_PORT}`;
  console.log(`  App   →  ${url}`);
  console.log(`  API   →  http://localhost:${API_PORT}`);
  console.log(`  MCP   →  http://localhost:${API_PORT}/api/mcp`);
  console.log('\n  Press Ctrl+C to stop.\n');

  openBrowser(url);
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? `open "${url}"`
            : process.platform === 'win32'  ? `start "" "${url}"`
            : `xdg-open "${url}"`;
  exec(cmd, err => { if (err) console.log(`  → Open ${url} in your browser`); });
}

main();
