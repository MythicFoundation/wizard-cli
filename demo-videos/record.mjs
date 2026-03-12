#!/usr/bin/env node
/**
 * Record Wizard CLI HTML demos as MP4 videos using Puppeteer screencast + ffmpeg.
 *
 * Usage:
 *   node record.mjs                      # Records hero demo
 *   node record.mjs wizard-hero-demo     # Records specific demo
 *   node record.mjs all                  # Records all demos
 */

import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIEWPORT = { width: 1920, height: 1080 };

// Duration per demo (seconds of recording after page load)
const DURATIONS = {
  'wizard-hero-demo': 42,
  'wizard-demo-agent-coding': 22,
  'wizard-demo-blockchain-tools': 22,
  'wizard-demo-full-features': 22,
};

async function recordDemo(htmlFile, outputName) {
  const htmlPath = path.join(__dirname, htmlFile);
  if (!existsSync(htmlPath)) {
    console.error(`File not found: ${htmlPath}`);
    return;
  }

  const webmPath = path.join(__dirname, `${outputName}.webm`);
  const mp4Path = path.join(__dirname, `${outputName}.mp4`);
  const duration = DURATIONS[outputName] || 30;

  console.log(`Recording ${htmlFile} → ${outputName}.mp4`);
  console.log(`  Resolution: ${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log(`  Duration: ${duration}s (real-time screencast)`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      '--no-sandbox',
      '--font-render-hinting=none',
      '--disable-lcd-text',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // Load and wait for fonts
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);

  // Start real-time screencast recording
  console.log('  Recording...');
  const recorder = await page.screencast({ path: webmPath });

  // Wait for the full animation + CTA
  await new Promise(r => setTimeout(r, duration * 1000));

  // Stop recording
  await recorder.stop();
  await browser.close();

  console.log('  Screencast captured. Converting to MP4...');

  // Convert WebM → MP4 with H.264 for broad compatibility
  try {
    execSync(
      `ffmpeg -y -i "${webmPath}" ` +
      `-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p ` +
      `-movflags +faststart ` +
      `"${mp4Path}"`,
      { stdio: 'pipe' }
    );

    // Clean up webm
    execSync(`rm "${webmPath}"`);

    const size = execSync(`ls -lh "${mp4Path}"`).toString().split(/\s+/)[4];
    console.log(`  ✓ ${mp4Path} (${size})`);
  } catch (err) {
    console.error('  ffmpeg error:', err.stderr?.toString().slice(0, 500));
    // Keep the webm as fallback
    if (existsSync(webmPath)) {
      const size = execSync(`ls -lh "${webmPath}"`).toString().split(/\s+/)[4];
      console.log(`  WebM fallback: ${webmPath} (${size})`);
    }
  }

  console.log('');
}

const DEMOS = {
  'wizard-hero-demo': 'wizard-hero-demo.html',
  'wizard-demo-agent-coding': 'wizard-demo-agent-coding.html',
  'wizard-demo-blockchain-tools': 'wizard-demo-blockchain-tools.html',
  'wizard-demo-full-features': 'wizard-demo-full-features.html',
};

const arg = process.argv[2] || 'wizard-hero-demo';

if (arg === 'all') {
  for (const [name, file] of Object.entries(DEMOS)) {
    await recordDemo(file, name);
  }
} else {
  const file = DEMOS[arg] || `${arg}.html`;
  const name = arg.replace('.html', '');
  await recordDemo(file, name);
}
