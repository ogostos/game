#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function usage() {
  console.error("Usage: node scripts/facts/extract-epub.mjs <input.epub> [output.json]");
  process.exit(1);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? "data/facts/epub-extract.json";

if (!inputPath) {
  usage();
}

function decode(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

const epubAbsolutePath = resolve(inputPath);
const outputAbsolutePath = resolve(outputPath);

const fileListText = execFileSync("unzip", ["-Z1", epubAbsolutePath], { encoding: "utf8" });
const contentFiles = fileListText
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => /\.(xhtml|html|htm)$/i.test(line))
  .sort();

if (contentFiles.length === 0) {
  console.error("No HTML/XHTML content files found in EPUB.");
  process.exit(2);
}

const paragraphs = [];

for (const file of contentFiles) {
  const raw = execFileSync("unzip", ["-p", epubAbsolutePath, file], { encoding: "utf8" });
  const cleaned = stripHtml(raw);

  if (cleaned.length < 80) {
    continue;
  }

  for (const chunk of cleaned.split(/(?<=[.!?])\s+/)) {
    const sentence = chunk.trim();

    if (sentence.length >= 50 && sentence.length <= 400) {
      paragraphs.push(sentence);
    }
  }
}

const uniqueParagraphs = [...new Set(paragraphs)];

const output = {
  source: epubAbsolutePath,
  extractedAt: new Date().toISOString(),
  totalCandidates: uniqueParagraphs.length,
  candidates: uniqueParagraphs
};

writeFileSync(outputAbsolutePath, JSON.stringify(output, null, 2), "utf8");
console.log(`Extracted ${uniqueParagraphs.length} candidate lines to ${outputAbsolutePath}`);
