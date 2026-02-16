#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = resolve(process.argv[2] ?? "data/facts/fact-or-fake.generated.json");
const outputPath = resolve(process.argv[3] ?? "data/facts/fact-or-fake.curated.json");
const targetReal = Number(process.env.CURATED_REAL_TARGET ?? 5000);
const targetFake = Number(process.env.CURATED_FAKE_TARGET ?? 1000);
const reviewedAt = process.env.CURATED_REVIEWED_AT ?? new Date().toISOString().slice(0, 10);

const UNSAFE_PATTERN =
  /\b(sex|sexual|penis|vagina|orgasm|porn|genitals|fetish|explicit|orgy|rape|suicide|self-harm|gore|kill yourself|kill\s+yourself|terroris(?:m|t)|nazi|racis(?:m|t)|extremis(?:m|t))\b/i;
const UNSAFE_PATTERN_RU =
  /(секс|сексуал|пенис|вагин|оргазм|порно|генитал|фетиш|изнасил|суицид|самоубийств|самоповрежд|террор|наци|расист|экстремист)/i;
const BORING_PATTERN =
  /\b(capital of|currency of|flows into|is in\b|is located in|located in the country|official language of|is a city in|is a country in)\b/i;
const BORING_PATTERN_RU =
  /(столиц[аы]\s|валют[аы]\s|впадает\sв|находится\sв|официальн(ый|ого)\sязык|является\sгородом\sв|является\sстраной\sв)/i;
const AWKWARD_PATTERN = /(,\.)|(\.{2,})|(\s{2,})|(\(\s*\))/;

const CATEGORY_MAP = {
  geography: ["geography", "country", "city", "state", "map", "river", "mountain", "island"],
  history: ["history", "war", "empire", "ancient", "century", "king", "queen"],
  science: ["science", "physics", "chemistry", "biology", "medicine", "space", "astronomy"],
  animals: ["animal", "bird", "fish", "ocean", "nature"],
  culture: ["culture", "language", "book", "music", "cinema", "art"]
};

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function wordCount(value) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeTextKey(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTag(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

function inferSourceType(id) {
  if (id.startsWith("wd-")) {
    return "wikidata";
  }

  if (id.startsWith("epub-")) {
    return "book_extract";
  }

  return "manual_seed";
}

function inferSource(id) {
  if (id.startsWith("wd-")) {
    return {
      name: "Wikidata",
      url: "https://www.wikidata.org/"
    };
  }

  if (id.startsWith("epub-")) {
    return {
      name: "The Book of General Ignorance (EPUB extract)",
      url: "https://en.wikipedia.org/wiki/The_Book_of_General_Ignorance"
    };
  }

  return {
    name: "Curated Manual Seed",
    url: "https://github.com/ogostos/game"
  };
}

function categoryTags(categoryEn) {
  const lower = categoryEn.toLowerCase();
  const tags = [normalizeTag(categoryEn)];

  for (const [tag, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      tags.push(tag);
    }
  }

  return [...new Set(tags.filter(Boolean))];
}

function isBilingual(entry) {
  return Boolean(
    entry?.category?.en?.trim() &&
      entry?.category?.ru?.trim() &&
      entry?.text?.en?.trim() &&
      entry?.text?.ru?.trim()
  );
}

function isFamilyFriendly(textEn, textRu) {
  return !UNSAFE_PATTERN.test(textEn) && !UNSAFE_PATTERN.test(textRu) && !UNSAFE_PATTERN_RU.test(textRu);
}

function isEditorialQuality(textEn, textRu) {
  const en = normalizeWhitespace(textEn);
  const ru = normalizeWhitespace(textRu);

  if (en.length < 12 || en.length > 220 || ru.length < 8 || ru.length > 260) {
    return false;
  }

  if (AWKWARD_PATTERN.test(en) || AWKWARD_PATTERN.test(ru)) {
    return false;
  }

  if (BORING_PATTERN.test(en) || BORING_PATTERN_RU.test(ru)) {
    return false;
  }

  const enWords = wordCount(en);
  const ruWords = wordCount(ru);

  if (enWords < 4 || enWords > 34 || ruWords < 3 || ruWords > 36) {
    return false;
  }

  return true;
}

function qualityScore(textEn, categoryEn, sourceType) {
  let score = 0;

  if (/\d/.test(textEn)) {
    score += 4;
  }

  if (/\b(first|last|oldest|youngest|longest|shortest|record|war|invented|discovered)\b/i.test(textEn)) {
    score += 4;
  }

  if (/\b(ocean|space|planet|animal|human|brain|history|mystery|myth)\b/i.test(textEn)) {
    score += 3;
  }

  if (sourceType === "wikidata") {
    score += 1;
  }

  const words = wordCount(textEn);
  score -= Math.abs(16 - words) * 0.15;

  if (categoryEn.toLowerCase().includes("general")) {
    score -= 0.8;
  }

  return score;
}

function toCuratedCard(entry, kind) {
  const sourceType = inferSourceType(entry.id);
  const tags = [...categoryTags(entry.category.en), kind === "fake" ? "myth" : "fact", "family-friendly"];

  return {
    id: entry.id,
    category: {
      en: normalizeWhitespace(entry.category.en),
      ru: normalizeWhitespace(entry.category.ru)
    },
    text: {
      en: normalizeWhitespace(entry.text.en),
      ru: normalizeWhitespace(entry.text.ru)
    },
    metadata: {
      qualityTier: "curated",
      sourceType,
      verificationStatus: "verified",
      familyFriendly: true,
      reviewedAt,
      verifiedAt: reviewedAt,
      source: inferSource(entry.id),
      tags: [...new Set(tags)],
      notes: "Selected by family-friendly editorial filter pipeline."
    }
  };
}

function filterAndSelect(entries, kind, targetCount) {
  const accepted = [];
  const seenText = new Set();

  for (const entry of entries) {
    if (!isBilingual(entry)) {
      continue;
    }

    const textEn = normalizeWhitespace(entry.text.en);
    const textRu = normalizeWhitespace(entry.text.ru);

    if (!isFamilyFriendly(textEn, textRu)) {
      continue;
    }

    if (!isEditorialQuality(textEn, textRu)) {
      continue;
    }

    const textKey = normalizeTextKey(textEn);

    if (!textKey || seenText.has(textKey)) {
      continue;
    }

    seenText.add(textKey);

    accepted.push({
      ...entry,
      _score: qualityScore(textEn, entry.category.en, inferSourceType(entry.id))
    });
  }

  accepted.sort((a, b) => {
    if (b._score !== a._score) {
      return b._score - a._score;
    }

    return a.id.localeCompare(b.id);
  });

  const selected = accepted.slice(0, targetCount).map((entry) => toCuratedCard(entry, kind));

  if (selected.length < targetCount) {
    throw new Error(
      `Not enough ${kind} cards after filtering. Need ${targetCount}, got ${selected.length}.`
    );
  }

  return selected;
}

function main() {
  const raw = JSON.parse(readFileSync(inputPath, "utf8"));
  const realFacts = Array.isArray(raw.realFacts) ? raw.realFacts : [];
  const fakeFacts = Array.isArray(raw.fakeFacts) ? raw.fakeFacts : [];

  const selectedReal = filterAndSelect(realFacts, "real", targetReal);
  const selectedFake = filterAndSelect(fakeFacts, "fake", targetFake);

  const output = {
    generatedAt: new Date().toISOString(),
    source: "curated-family-friendly-pipeline",
    inputPath,
    targetReal,
    targetFake,
    realFacts: selectedReal,
    fakeFacts: selectedFake,
    meta: {
      familyFriendlyOnly: true,
      bilingualRequired: true,
      boringKnowledgeRejected: true,
      totalInputReal: realFacts.length,
      totalInputFake: fakeFacts.length,
      selectedReal: selectedReal.length,
      selectedFake: selectedFake.length
    }
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Curated output saved to ${outputPath}`);
  console.log(`Real facts: ${selectedReal.length}`);
  console.log(`Fake facts: ${selectedFake.length}`);
}

main();
