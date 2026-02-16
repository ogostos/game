#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = resolve(process.argv[2] ?? "data/facts/fact-or-fake.generated.json");
const outputPath = resolve(process.argv[3] ?? "data/facts/fact-or-fake.curated.json");
const cachePath = resolve(process.argv[4] ?? "data/facts/translation-cache.en-ru.json");
const targetReal = Number(process.env.CURATED_REAL_TARGET ?? 5000);
const targetFake = Number(process.env.CURATED_FAKE_TARGET ?? 1000);
const reviewedAt = process.env.CURATED_REVIEWED_AT ?? new Date().toISOString().slice(0, 10);
const translationBatchSize = Number(process.env.TRANSLATE_BATCH_SIZE ?? 12);
const translationRetries = Number(process.env.TRANSLATE_RETRIES ?? 3);
const translationTimeoutMs = Number(process.env.TRANSLATE_TIMEOUT_MS ?? 25000);
const marker = "[[[SEP_73291_X]]]]";

const UNSAFE_PATTERN =
  /\b(sex|sexual|penis|vagina|orgasm|porn|genitals|fetish|explicit|orgy|rape|suicide|self-harm|gore|kill yourself|kill\s+yourself|terroris(?:m|t)|nazi|racis(?:m|t)|extremis(?:m|t))\b/i;
const UNSAFE_PATTERN_RU =
  /(секс|сексуал|пенис|вагин|оргазм|порно|генитал|фетиш|изнасил|суицид|самоубийств|самоповрежд|террор|наци|расист|экстремист)/i;
const BORING_PATTERN =
  /\b(capital of|currency of|flows into|is in\b|is located in|located in the country|official language of|is a city in|is a country in|writing system|uses the .* script)\b/i;
const BORING_PATTERN_RU =
  /(столиц[аы]\s|валют[аы]\s|впадает\sв|находится\sв|официальн(ый|ого)\sязык|является\sгородом\sв|является\sстраной\sв|система\sписьма|письменност)/i;
const AWKWARD_PATTERN = /(,\.)|(\.{2,})|(\s{2,})|(\(\s*\))/;
const UNWANTED_PREFIX_PATTERN =
  /^(A verified fact states that|Historical sources report that|Reliable references show that)\b/i;
const UNWANTED_PREFIX_PATTERN_RU =
  /^(Проверенный факт гласит, что|Исторические источники сообщают, что|Надежные источники показывают, что)\b/i;
const TRAILING_CONJUNCTION_PATTERN = /\b(and|or|but)\.$/i;
const TRAILING_PUNCTUATION_PATTERN = /[,;:]\.?$/;
const HISTORY_HEAVY_PATTERN =
  /\b(ancient|medieval|pharaoh|roman empire|victorian|in the 1[0-9]{2,3}s|in the 18th century|in the 17th century|in the 16th century)\b/i;
const OLD_YEAR_PATTERN = /\b(1[0-8][0-9]{2}|19[0-4][0-9])\b/i;
const EXTRACTION_ARTIFACT_PATTERN =
  /(^\W*so we are told\b)|(\b[a-d]\s*\))|(\b[a-d]\)\b)|(\bno eyes\b)|(\bq\s*[:\-])/i;
const BORING_EDITORIAL_PATTERN =
  /\b(was published in|published under|was first officially used|was devised in|according to|historian|biography|journal|court entertainment|international meteorological conference|latin vulgate)\b/i;

const ALLOWED_CATEGORY_HINTS = [
  "geography",
  "nature",
  "science",
  "culture",
  "human body",
  "technology",
  "food",
  "weather",
  "ocean",
  "climate",
  "world"
];

const BLOCKED_CATEGORY_HINTS = ["language"];

const INTERESTING_HINT_PATTERN =
  /\b(climate|planet|earth|ocean|river|mountain|city|country|president|culture|tradition|music|food|technology|science|weather|storm|temperature|record|first|largest|smallest|oldest|rare|unexpected|surprising|myth|global|world|space|animal)\b|\d/i;

const MODERN_HINT_PATTERN =
  /\b(current|today|modern|global|internet|digital|president|prime minister|election|202[0-9]|201[5-9])\b/i;
const PREFERRED_TOPIC_PATTERN =
  /\b(geography|climate|weather|temperature|storm|ocean|sea|river|mountain|island|world|global|planet|earth|culture|food|music|art|science|technology|internet|digital|president|prime minister|election|city|country|population|record|space|animal)\b/i;

const CATEGORY_MAP = {
  geography: ["geography", "country", "city", "state", "map", "river", "mountain", "island", "world"],
  climate: ["climate", "weather", "temperature", "ocean", "storm", "atmosphere", "earth"],
  culture: ["culture", "music", "book", "cinema", "art", "tradition", "food"],
  science: ["science", "physics", "chemistry", "biology", "medicine", "space", "astronomy", "technology"],
  politics: ["politics", "president", "government", "election", "prime minister"],
  history: ["history", "war", "empire", "ancient", "century", "king", "queen"],
  animals: ["animal", "bird", "fish", "ocean", "nature"]
};

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function wordCount(value) {
  return normalizeWhitespace(value)
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
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

function hasCyrillic(value) {
  return /[А-Яа-яЁё]/.test(value);
}

function hasBalancedParentheses(value) {
  let depth = 0;

  for (const char of value) {
    if (char === "(") {
      depth += 1;
    }

    if (char === ")") {
      depth -= 1;
    }

    if (depth < 0) {
      return false;
    }
  }

  return depth === 0;
}

function sanitizeEnglishText(value) {
  let text = normalizeWhitespace(value);

  text = text.replace(UNWANTED_PREFIX_PATTERN, "");
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  text = text.replace(/([,.;:!?])\1+/g, "$1");
  text = text.replace(/\s{2,}/g, " ");

  return text.trim();
}

function sanitizeRussianText(value) {
  let text = normalizeWhitespace(value);

  text = text.replace(UNWANTED_PREFIX_PATTERN_RU, "");
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  text = text.replace(/([,.;:!?])\1+/g, "$1");
  text = text.replace(/\s{2,}/g, " ");

  return text.trim();
}

function hasPreferredTopicSignal(categoryEn, textEn) {
  return PREFERRED_TOPIC_PATTERN.test(`${categoryEn} ${textEn}`);
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

function categoryTags(categoryEn, textEn) {
  const combined = `${categoryEn} ${textEn}`.toLowerCase();
  const tags = [normalizeTag(categoryEn)];

  for (const [tag, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some((keyword) => combined.includes(keyword))) {
      tags.push(tag);
    }
  }

  return [...new Set(tags.filter(Boolean))];
}

function isFamilyFriendly(textEn, textRu) {
  return !UNSAFE_PATTERN.test(textEn) && !UNSAFE_PATTERN.test(textRu) && !UNSAFE_PATTERN_RU.test(textRu);
}

function categoryAllowed(categoryEn, textEn) {
  const lowerCategory = categoryEn.toLowerCase();
  const lowerText = textEn.toLowerCase();

  if (BLOCKED_CATEGORY_HINTS.some((hint) => lowerCategory.includes(hint))) {
    return false;
  }

  if (BORING_PATTERN.test(lowerText)) {
    return false;
  }

  return true;
}

function isEditorialQualityEnglish(textEn) {
  const en = normalizeWhitespace(textEn);

  if (en.length < 8 || en.length > 220) {
    return false;
  }

  if (AWKWARD_PATTERN.test(en)) {
    return false;
  }

  if (UNWANTED_PREFIX_PATTERN.test(en)) {
    return false;
  }

  if (TRAILING_CONJUNCTION_PATTERN.test(en)) {
    return false;
  }

  if (TRAILING_PUNCTUATION_PATTERN.test(en)) {
    return false;
  }

  if (EXTRACTION_ARTIFACT_PATTERN.test(en)) {
    return false;
  }

  if (!hasBalancedParentheses(en)) {
    return false;
  }

  if (BORING_PATTERN.test(en)) {
    return false;
  }

  const words = wordCount(en);

  if (words < 3 || words > 45) {
    return false;
  }

  return true;
}

function isEditorialQualityRussian(textRu) {
  const ru = normalizeWhitespace(textRu);

  if (ru.length < 10 || ru.length > 260) {
    return false;
  }

  if (AWKWARD_PATTERN.test(ru)) {
    return false;
  }

  if (TRAILING_CONJUNCTION_PATTERN.test(ru)) {
    return false;
  }

  if (TRAILING_PUNCTUATION_PATTERN.test(ru)) {
    return false;
  }

  if (!hasBalancedParentheses(ru)) {
    return false;
  }

  if (BORING_PATTERN_RU.test(ru)) {
    return false;
  }

  const words = wordCount(ru);

  if (words < 4 || words > 36) {
    return false;
  }

  return true;
}

function qualityScore(textEn, categoryEn, sourceType) {
  const lower = textEn.toLowerCase();
  let score = 0;

  if (/\d/.test(textEn)) {
    score += 3;
  }

  if (INTERESTING_HINT_PATTERN.test(textEn)) {
    score += 5;
  }

  if (MODERN_HINT_PATTERN.test(textEn)) {
    score += 3;
  }

  if (/\b(ocean|climate|weather|temperature|culture|planet|earth|science|technology|president|global|world)\b/i.test(textEn)) {
    score += 4;
  }

  if (hasPreferredTopicSignal(categoryEn, textEn)) {
    score += 4;
  }

  if (HISTORY_HEAVY_PATTERN.test(lower) || categoryEn.toLowerCase().includes("history")) {
    score -= 5;
  }

  if (OLD_YEAR_PATTERN.test(textEn)) {
    score -= 1.5;
  }

  if (BORING_EDITORIAL_PATTERN.test(textEn)) {
    score -= 3.5;
  }

  if (categoryEn.toLowerCase().includes("cinema")) {
    score -= 3;
  }

  if (sourceType === "wikidata") {
    score += 1;
  }

  score -= Math.abs(16 - wordCount(textEn)) * 0.12;

  if (categoryEn.toLowerCase().includes("general")) {
    score -= 1.2;
  }

  if (categoryEn.toLowerCase().includes("cinema")) {
    score -= 1.2;
  }

  if (sourceType === "book_extract") {
    score -= 0.8;
  }

  return score;
}

function isLessPreferredCandidate(categoryEn, textEn) {
  const lowerCategory = categoryEn.toLowerCase();

  if (lowerCategory.includes("history") || lowerCategory.includes("cinema")) {
    return true;
  }

  if (HISTORY_HEAVY_PATTERN.test(textEn)) {
    return true;
  }

  if (OLD_YEAR_PATTERN.test(textEn)) {
    return true;
  }

  if (BORING_EDITORIAL_PATTERN.test(textEn)) {
    return true;
  }

  if (lowerCategory.includes("general") && !hasPreferredTopicSignal(categoryEn, textEn)) {
    return true;
  }

  return false;
}

function prepareCandidates(entries, kind) {
  const accepted = [];
  const seenText = new Set();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const categoryEn = normalizeWhitespace(entry?.category?.en ?? "");
    const categoryRu = normalizeWhitespace(entry?.category?.ru ?? "");
    const textEn = sanitizeEnglishText(entry?.text?.en ?? "");
    const textRu = sanitizeRussianText(entry?.text?.ru ?? "");

    if (!id || !categoryEn || !textEn) {
      continue;
    }

    if (!isFamilyFriendly(textEn, textRu || textEn)) {
      continue;
    }

    if (!categoryAllowed(categoryEn, textEn)) {
      continue;
    }

    if (!isEditorialQualityEnglish(textEn)) {
      continue;
    }

    const textKey = normalizeTextKey(textEn);

    if (!textKey || seenText.has(textKey)) {
      continue;
    }

    seenText.add(textKey);

    accepted.push({
      id,
      category: {
        en: categoryEn,
        ru: categoryRu
      },
      text: {
        en: textEn,
        ru: textRu
      },
      _kind: kind,
      _score: qualityScore(textEn, categoryEn, inferSourceType(id))
    });
  }

  accepted.sort((a, b) => {
    if (b._score !== a._score) {
      return b._score - a._score;
    }

    return a.id.localeCompare(b.id);
  });

  return accepted;
}

function loadTranslationCache() {
  if (!existsSync(cachePath)) {
    return {};
  }

  try {
    const raw = JSON.parse(readFileSync(cachePath, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveTranslationCache(cache) {
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

async function translateChunkEnglishToRussian(texts) {
  if (texts.length === 0) {
    return [];
  }

  const joined = texts.join(`\n${marker}\n`);
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", "ru");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", joined);

  for (let attempt = 1; attempt <= translationRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), translationTimeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "imposter-game-box/0.1 curated translator"
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Translation HTTP ${response.status}`);
      }

      const payload = await response.json();
      const translated = Array.isArray(payload?.[0])
        ? payload[0].map((item) => item?.[0] ?? "").join("")
        : "";

      const parts = translated
        .split(marker)
        .map((part) => normalizeWhitespace(part))
        .filter((part, index) => index < texts.length);

      if (parts.length !== texts.length) {
        throw new Error(`Unexpected translation split count: expected ${texts.length}, got ${parts.length}`);
      }

      return parts;
    } catch (error) {
      clearTimeout(timeout);

      if (attempt === translationRetries) {
        throw error;
      }

      await sleep(400 * attempt);
    }
  }

  throw new Error("Translation retries exhausted.");
}

async function ensureRussianTranslations(candidates, cache) {
  const missing = [];

  for (const entry of candidates) {
    const categoryNeedsTranslation = !entry.category.ru || !hasCyrillic(entry.category.ru);
    const textNeedsTranslation = !entry.text.ru || !hasCyrillic(entry.text.ru) || entry.text.ru === entry.text.en;

    if (categoryNeedsTranslation && !cache[entry.category.en]) {
      missing.push(entry.category.en);
    }

    if (textNeedsTranslation && !cache[entry.text.en]) {
      missing.push(entry.text.en);
    }
  }

  const uniqueMissing = [...new Set(missing.map((value) => normalizeWhitespace(value)).filter(Boolean))];

  if (uniqueMissing.length === 0) {
    return;
  }

  console.log(`Translating ${uniqueMissing.length} unique EN strings to RU...`);

  for (let index = 0; index < uniqueMissing.length; index += translationBatchSize) {
    const chunk = uniqueMissing.slice(index, index + translationBatchSize);
    const translated = await translateChunkEnglishToRussian(chunk);

    for (let itemIndex = 0; itemIndex < chunk.length; itemIndex += 1) {
      const source = chunk[itemIndex];
      const target = normalizeWhitespace(translated[itemIndex] ?? "");

      if (target && hasCyrillic(target)) {
        cache[source] = target;
      }
    }

    if ((index / translationBatchSize + 1) % 20 === 0) {
      console.log(`Translated ${Math.min(index + translationBatchSize, uniqueMissing.length)} / ${uniqueMissing.length}`);
      saveTranslationCache(cache);
    }

    await sleep(120);
  }

  saveTranslationCache(cache);
}

function toCuratedCard(candidate, kind, cache) {
  const categoryRuFromCache = cache[candidate.category.en] ?? "";
  const textRuFromCache = cache[candidate.text.en] ?? "";

  const categoryRu = hasCyrillic(candidate.category.ru) ? candidate.category.ru : categoryRuFromCache;
  const textRu =
    hasCyrillic(candidate.text.ru) && candidate.text.ru !== candidate.text.en
      ? candidate.text.ru
      : textRuFromCache;

  if (!categoryRu || !textRu) {
    return null;
  }

  if (!isFamilyFriendly(candidate.text.en, textRu)) {
    return null;
  }

  if (!isEditorialQualityRussian(textRu)) {
    return null;
  }

  const sourceType = inferSourceType(candidate.id);
  const tags = [
    ...categoryTags(candidate.category.en, candidate.text.en),
    kind === "fake" ? "myth" : "fact",
    "family-friendly"
  ];

  return {
    id: candidate.id,
    category: {
      en: candidate.category.en,
      ru: categoryRu
    },
    text: {
      en: candidate.text.en,
      ru: textRu
    },
    metadata: {
      qualityTier: "curated",
      sourceType,
      verificationStatus: "verified",
      familyFriendly: true,
      reviewedAt,
      verifiedAt: reviewedAt,
      source: inferSource(candidate.id),
      tags: [...new Set(tags)],
      notes: "Selected by family-friendly editorial filter pipeline."
    }
  };
}

async function buildSelection(entries, kind, targetCount, cache) {
  const candidates = prepareCandidates(entries, kind);
  const effectiveTarget = Math.min(targetCount, candidates.length);

  if (candidates.length < targetCount) {
    console.warn(
      `Not enough ${kind} candidates for target ${targetCount}. Using ${effectiveTarget} after strict editorial filtering.`
    );
  }

  const preferred = candidates.filter(
    (candidate) => !isLessPreferredCandidate(candidate.category.en, candidate.text.en)
  );
  const lessPreferred = candidates.filter((candidate) =>
    isLessPreferredCandidate(candidate.category.en, candidate.text.en)
  );
  const orderedCandidates = [...preferred, ...lessPreferred];

  if (orderedCandidates.length < effectiveTarget) {
    throw new Error(`Not enough ${kind} candidates after prioritization.`);
  }

  const buffer = Math.max(250, Math.floor(effectiveTarget * 0.35));
  const sliceSize = Math.min(orderedCandidates.length, effectiveTarget + buffer);
  const initialSlice = orderedCandidates.slice(0, sliceSize);

  await ensureRussianTranslations(initialSlice, cache);

  const selected = [];

  for (const candidate of initialSlice) {
    const card = toCuratedCard(candidate, kind, cache);

    if (!card) {
      continue;
    }

    selected.push(card);

    if (selected.length >= effectiveTarget) {
      break;
    }
  }

  if (selected.length >= effectiveTarget) {
    return selected;
  }

  const fallbackSlice = orderedCandidates.slice(sliceSize);

  if (fallbackSlice.length > 0) {
    await ensureRussianTranslations(fallbackSlice, cache);

    for (const candidate of fallbackSlice) {
      const card = toCuratedCard(candidate, kind, cache);

      if (!card) {
        continue;
      }

      selected.push(card);

      if (selected.length >= effectiveTarget) {
        break;
      }
    }
  }

  if (selected.length === 0) {
    throw new Error(`No ${kind} cards passed translation and editorial checks.`);
  }

  if (selected.length < effectiveTarget) {
    console.warn(
      `Final ${kind} output below filtered target. Requested ${effectiveTarget}, selected ${selected.length} after RU editorial validation.`
    );
  }

  return selected;
}

async function main() {
  const raw = JSON.parse(readFileSync(inputPath, "utf8"));
  const realFacts = Array.isArray(raw.realFacts) ? raw.realFacts : [];
  const fakeFacts = Array.isArray(raw.fakeFacts) ? raw.fakeFacts : [];
  const cache = loadTranslationCache();

  console.log(`Input real facts: ${realFacts.length}`);
  console.log(`Input fake facts: ${fakeFacts.length}`);

  const selectedReal = await buildSelection(realFacts, "real", targetReal, cache);
  const selectedFake = await buildSelection(fakeFacts, "fake", targetFake, cache);

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
      preferredDomains: ["geography", "climate", "world", "culture", "science", "technology"],
      totalInputReal: realFacts.length,
      totalInputFake: fakeFacts.length,
      requestedReal: targetReal,
      requestedFake: targetFake,
      selectedReal: selectedReal.length,
      selectedFake: selectedFake.length,
      translationCachePath: cachePath
    }
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
  saveTranslationCache(cache);

  console.log(`Curated output saved to ${outputPath}`);
  console.log(`Real facts: ${selectedReal.length}`);
  console.log(`Fake facts: ${selectedFake.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
