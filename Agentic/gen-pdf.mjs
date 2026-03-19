import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('Agentic/andoni-pitch-deck.html');
const outputPath = path.resolve('Agentic/andoni-pitch-deck.pdf');

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });

// Get total number of slides
const totalSlides = await page.evaluate(() => document.querySelectorAll('.slide').length);
console.log(`Found ${totalSlides} slides`);

const pdfBuffers = [];

for (let i = 0; i < totalSlides; i++) {
  // Navigate to slide
  await page.evaluate((idx) => {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.d');
    slides.forEach(s => s.classList.remove('a'));
    dots.forEach(d => d.classList.remove('a'));
    slides[idx].classList.add('a');
    if (dots[idx]) dots[idx].classList.add('a');
  }, i);

  await new Promise(r => setTimeout(r, 500)); // wait for transition

  // Hide nav buttons and counter for PDF
  await page.evaluate(() => {
    document.querySelector('.nv').style.display = 'none';
    document.querySelector('.ct').style.display = 'none';
    document.querySelector('.pb').style.display = 'none';
  });

  const pdf = await page.pdf({
    width: '1440px',
    height: '900px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  pdfBuffers.push(pdf);
  console.log(`Slide ${i + 1}/${totalSlides} captured`);
}

await browser.close();

// Merge all PDFs
const mergedPdf = await PDFDocument.create();

for (const buf of pdfBuffers) {
  const doc = await PDFDocument.load(buf);
  const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
  pages.forEach(p => mergedPdf.addPage(p));
}

const mergedBytes = await mergedPdf.save();
fs.writeFileSync(outputPath, mergedBytes);
console.log(`PDF saved to ${outputPath} (${(mergedBytes.length / 1024).toFixed(0)}KB)`);
