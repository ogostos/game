#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const DEFAULT_OUTPUT_PATH = "data/facts/fact-or-fake.epub-fakes.json";
const DEFAULT_CACHE_PATH = "data/facts/translation-cache.en-ru.json";
const DEFAULT_TARGET = Number(process.env.EPUB_FAKE_TARGET ?? 1000);
const reviewedAt = new Date().toISOString().slice(0, 10);
const translationBatchSize = Number(process.env.TRANSLATE_BATCH_SIZE ?? 12);
const translationRetries = Number(process.env.TRANSLATE_RETRIES ?? 3);
const translationTimeoutMs = Number(process.env.TRANSLATE_TIMEOUT_MS ?? 25000);
const offlineTranslationOnly = process.env.OFFLINE_TRANSLATION_ONLY === "1";
const currentYear = 2026;

const UNSAFE_PATTERN =
  /\b(sex|sexual|penis|vagina|orgasm|porn|genitals|fetish|explicit|orgy|rape|suicide|self-harm|gore|kill yourself|murder|terror|nazi|racis(?:m|t)|extremis(?:m|t))\b/i;
const UNSAFE_PATTERN_RU =
  /(секс|сексуал|пенис|вагин|оргазм|порно|генитал|фетиш|изнасил|суицид|самоубийств|самоповрежд|убийств|террор|наци|расист|экстремист)/i;
const AWKWARD_PATTERN = /(\.\.\.|;;|,,|  +|`|\\u0000)/;
const HEADING_PATTERN =
  /\b(chapter|contents|copyright|isbn|appendix|bibliography|references|index|acknowledg(e)?ments)\b/i;
const PRONOUN_START_PATTERN = /^(it|this|that|these|those|he|she|they|his|her|their)\b/i;
const LOW_SIGNAL_PATTERN =
  /\b(page|figure|table|paragraph|author|publisher|edition|copyright|ebook|kindle)\b/i;
const INTERESTING_PATTERN =
  /\b(largest|smallest|longest|shortest|highest|lowest|deepest|oldest|youngest|invented|discovered|planet|moon|earth|ocean|sea|river|mountain|desert|volcano|species|animal|bird|brain|memory|human|history|culture|technology|science|country|city|language|climate|space|medieval|roman|empire|physics|chemistry|biology|medicine)\b/i;
const WEAK_STYLE_PATTERN =
  /\b(according to|for example|in this chapter|as discussed|as we saw|it follows that|therefore|in conclusion)\b/i;
const DIALOGUE_PATTERN = /^([A-Z][A-Z0-9'" .-]{1,20}:|\[[A-Z0-9 '"-]{2,20}\])/;
const QUOTE_FRAGMENT_PATTERN = /\b(wrote|said|says)\s*:\s*['"]/i;
const MYTH_CUE_PATTERNS = [
  /\b(?:a\s+persistent\s+)?misconception\s+is\s+that\s+([^.;!?]{15,180})/i,
  /\b(?:the\s+)?myth(?:\s+that)?\s+([^.;!?]{15,180})/i,
  /\bcontrary to popular belief,\s+([^.;!?]{15,180})/i,
  /\bit is (?:a\s+)?myth that\s+([^.;!?]{15,180})/i,
  /\bthe claim that\s+([^.;!?]{15,180})\s+is\s+(?:false|incorrect|wrong)\b/i
];

const CATEGORY_RULES = [
  {
    en: "Nature",
    ru: "Природа",
    keywords: ["animal", "bird", "fish", "ocean", "sea", "forest", "tree", "species", "whale", "insect"]
  },
  {
    en: "Science",
    ru: "Наука",
    keywords: ["science", "physics", "chemistry", "biology", "atom", "molecule", "element", "experiment"]
  },
  {
    en: "Space",
    ru: "Космос",
    keywords: ["space", "planet", "moon", "solar", "orbit", "asteroid", "comet", "galaxy", "star"]
  },
  {
    en: "Human Body",
    ru: "Человек",
    keywords: ["human", "brain", "heart", "blood", "body", "disease", "medical", "health", "muscle", "bone"]
  },
  {
    en: "History",
    ru: "История",
    keywords: ["history", "roman", "empire", "king", "queen", "war", "ancient", "century", "medieval"]
  },
  {
    en: "Geography",
    ru: "География",
    keywords: ["country", "city", "capital", "river", "mountain", "island", "continent", "desert", "climate"]
  },
  {
    en: "Culture",
    ru: "Культура",
    keywords: ["music", "book", "film", "artist", "painting", "language", "tradition", "festival", "myth"]
  },
  {
    en: "Technology",
    ru: "Технологии",
    keywords: ["technology", "computer", "internet", "phone", "electric", "machine", "battery", "radio", "engine"]
  },
  {
    en: "Politics",
    ru: "Политика",
    keywords: ["president", "parliament", "government", "democracy", "election", "military", "state", "policy"]
  }
];

const NEGATION_RULES = [
  { pattern: /\bdid not\b/i, replacement: "did", tag: "did-not" },
  { pattern: /\bdidn't\b/i, replacement: "did", tag: "didnt" },
  { pattern: /\bdoes not\b/i, replacement: "does", tag: "does-not" },
  { pattern: /\bdoesn't\b/i, replacement: "does", tag: "doesnt" },
  { pattern: /\bdo not\b/i, replacement: "do", tag: "do-not" },
  { pattern: /\bdon't\b/i, replacement: "do", tag: "dont" },
  { pattern: /\bis not\b/i, replacement: "is", tag: "is-not" },
  { pattern: /\bisn't\b/i, replacement: "is", tag: "isnt" },
  { pattern: /\bare not\b/i, replacement: "are", tag: "are-not" },
  { pattern: /\baren't\b/i, replacement: "are", tag: "arent" },
  { pattern: /\bwas not\b/i, replacement: "was", tag: "was-not" },
  { pattern: /\bwasn't\b/i, replacement: "was", tag: "wasnt" },
  { pattern: /\bwere not\b/i, replacement: "were", tag: "were-not" },
  { pattern: /\bweren't\b/i, replacement: "were", tag: "werent" },
  { pattern: /\bcannot\b/i, replacement: "can", tag: "cannot" },
  { pattern: /\bcan't\b/i, replacement: "can", tag: "cant" },
  { pattern: /\bnever\b/i, replacement: "often", tag: "never" }
];

const BOOK_SOURCE_RULES = [
  {
    pattern: /General_Ignorance/i,
    code: "gi",
    name: "The Book of General Ignorance",
    url: "https://en.wikipedia.org/wiki/The_Book_of_General_Ignorance"
  },
  {
    pattern: /Why_People_Believe_Weird_Things/i,
    code: "wpbt",
    name: "Why People Believe Weird Things",
    url: "https://en.wikipedia.org/wiki/Why_People_Believe_Weird_Things"
  },
  {
    pattern: /Skeptics_39_Guide/i,
    code: "sgu",
    name: "The Skeptics' Guide to the Universe",
    url: "https://en.wikipedia.org/wiki/The_Skeptics%27_Guide_to_the_Universe"
  },
  {
    pattern: /Do_Fish_Drink_Water/i,
    code: "dfdw",
    name: "Do Fish Drink Water?",
    url: "https://www.goodreads.com/book/show/16067568-do-fish-drink-water"
  }
];

function usage() {
  console.error(
    "Usage: node scripts/facts/build-epub-fakes-curated.mjs [output.json] <book1.epub> <book2.epub> ..."
  );
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    usage();
  }

  let outputPath = DEFAULT_OUTPUT_PATH;
  const epubPaths = [];

  for (const arg of args) {
    if (/\.epub$/i.test(arg)) {
      epubPaths.push(resolve(arg));
      continue;
    }

    if (/\.json$/i.test(arg) && outputPath === DEFAULT_OUTPUT_PATH) {
      outputPath = arg;
      continue;
    }
  }

  if (epubPaths.length === 0 && args.length === 2 && /\.epub$/i.test(args[0]) && /\.json$/i.test(args[1])) {
    epubPaths.push(resolve(args[0]));
    outputPath = args[1];
  }

  if (epubPaths.length === 0) {
    usage();
  }

  return {
    outputPath: resolve(outputPath),
    cachePath: resolve(DEFAULT_CACHE_PATH),
    epubPaths,
    target: DEFAULT_TARGET
  };
}

function decodeEntities(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(html) {
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return String(value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTag(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

function ensureTerminalPeriod(value) {
  const trimmed = normalizeText(value).replace(/\s+([,.;!?])/g, "$1");

  if (!trimmed) {
    return "";
  }

  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}.`;
}

function hasCyrillic(value) {
  return /[А-Яа-яЁё]/.test(value);
}

function isFamilyFriendlyEnglish(value) {
  return !UNSAFE_PATTERN.test(value);
}

function isFamilyFriendlyRussian(value) {
  return !UNSAFE_PATTERN_RU.test(value);
}

function wordsCount(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean).length;
}

function properNounCount(value) {
  const words = normalizeText(value).split(/\s+/).filter(Boolean);
  let count = 0;

  for (let index = 1; index < words.length; index += 1) {
    const token = words[index].replace(/[^A-Za-z]/g, "");

    if (/^[A-Z][a-z]+$/.test(token)) {
      count += 1;
    }
  }

  return count;
}

function sanitizeSentence(value) {
  return ensureTerminalPeriod(
    normalizeText(value)
      .replace(/^\s*(In fact|Actually|However|But|Yet|Still|Therefore|So)\b[, ]*/i, "")
      .replace(/^\s*(And|Or)\b[, ]*/i, "")
      .replace(/\([^)]{40,}\)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

function trimToWordLimit(value, maxWords) {
  const words = normalizeText(value).split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return ensureTerminalPeriod(words.join(" "));
  }

  return ensureTerminalPeriod(words.slice(0, maxWords).join(" "));
}

function detectSourceInfo(epubPath) {
  const base = basename(epubPath);

  for (const source of BOOK_SOURCE_RULES) {
    if (source.pattern.test(base)) {
      return source;
    }
  }

  const slug = normalizeTag(base.replace(/\.epub$/i, "")) || "epub";

  return {
    code: slug.slice(0, 12),
    name: base.replace(/\.epub$/i, "").replace(/[_-]+/g, " "),
    url: "https://github.com/ogostos/game"
  };
}

function detectCategory(text) {
  const lower = normalizeText(text).toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => lower.includes(keyword))) {
      return { en: rule.en, ru: rule.ru };
    }
  }

  return { en: "General Knowledge", ru: "Общие знания" };
}

function isLikelyStandaloneSentence(text) {
  if (!text || !/^[A-Z]/.test(text)) {
    return false;
  }

  if (/^What\b/.test(text)) {
    return false;
  }

  if (PRONOUN_START_PATTERN.test(text)) {
    return false;
  }

  if (HEADING_PATTERN.test(text) || LOW_SIGNAL_PATTERN.test(text)) {
    return false;
  }

  if (QUOTE_FRAGMENT_PATTERN.test(text)) {
    return false;
  }

  if (AWKWARD_PATTERN.test(text)) {
    return false;
  }

  if (/https?:\/\//i.test(text)) {
    return false;
  }

  if (/\?$/.test(text)) {
    return false;
  }

  return true;
}

function isUsableCorrectionSentence(text) {
  if (!text || !/^[A-Z]/.test(text)) {
    return false;
  }

  if (/\?$/.test(text)) {
    return false;
  }

  if (HEADING_PATTERN.test(text) || LOW_SIGNAL_PATTERN.test(text)) {
    return false;
  }

  if (DIALOGUE_PATTERN.test(text) || QUOTE_FRAGMENT_PATTERN.test(text)) {
    return false;
  }

  if (AWKWARD_PATTERN.test(text) || /https?:\/\//i.test(text)) {
    return false;
  }

  return true;
}

function sentenceVariants(sentence) {
  const variants = new Set();
  const base = sanitizeSentence(sentence);

  if (base) {
    variants.add(base);
  }

  const colonAndSemicolonParts = base
    .split(/;\s+|:\s+/)
    .map((part) => sanitizeSentence(part))
    .filter(Boolean);

  for (const part of colonAndSemicolonParts) {
    variants.add(part);
  }

  const commaClauseParts = base
    .split(/,\s+(?=(?:but|and|which|that|because|while|although|though)\b)/i)
    .map((part) => sanitizeSentence(part))
    .filter(Boolean);

  for (const part of commaClauseParts) {
    variants.add(part);
  }

  return [...variants].filter((part) => part.length >= 24 && part.length <= 220);
}

function passesCardStyleRules(fakeEn, correctionEn) {
  if (!isLikelyStandaloneSentence(fakeEn) || !isUsableCorrectionSentence(correctionEn)) {
    return false;
  }

  if (DIALOGUE_PATTERN.test(fakeEn) || DIALOGUE_PATTERN.test(correctionEn)) {
    return false;
  }

  if (!isFamilyFriendlyEnglish(fakeEn) || !isFamilyFriendlyEnglish(correctionEn)) {
    return false;
  }

  if (WEAK_STYLE_PATTERN.test(fakeEn) || WEAK_STYLE_PATTERN.test(correctionEn)) {
    return false;
  }

  if (fakeEn.includes("...") || correctionEn.includes("...")) {
    return false;
  }

  const fakeWords = wordsCount(fakeEn);
  const correctionWords = wordsCount(correctionEn);

  if (fakeWords < 6 || fakeWords > 24) {
    return false;
  }

  if (correctionWords < 6 || correctionWords > 30) {
    return false;
  }

  if (properNounCount(fakeEn) > 4 || properNounCount(correctionEn) > 4) {
    return false;
  }

  const years = [...fakeEn.matchAll(/\b(\d{4})\b/g)].map((match) => Number(match[1]));

  if (years.some((year) => year > currentYear || year < 500)) {
    return false;
  }

  return true;
}

function qualityScore(fakeEn, correctionEn) {
  let score = 0;
  const fakeWords = wordsCount(fakeEn);
  const correctionWords = wordsCount(correctionEn);

  if (fakeWords >= 8 && fakeWords <= 15) {
    score += 5;
  } else if (fakeWords >= 6 && fakeWords <= 18) {
    score += 2;
  }

  if (correctionWords >= 8 && correctionWords <= 18) {
    score += 3;
  }

  if (!/\d/.test(fakeEn)) {
    score += 1;
  }

  if (INTERESTING_PATTERN.test(fakeEn)) {
    score += 2;
  }

  score -= properNounCount(fakeEn) * 0.8;
  score -= Math.max(0, fakeWords - 17) * 0.2;

  return score;
}

function listContentFiles(epubPath) {
  const fileListText = execFileSync("unzip", ["-Z1", epubPath], { encoding: "utf8" });

  return fileListText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && /\.(xhtml|html|htm)$/i.test(line))
    .sort();
}

function loadSentencesFromEpub(epubPath) {
  const files = listContentFiles(epubPath);
  const rows = [];
  const source = detectSourceInfo(epubPath);

  for (const file of files) {
    const raw = execFileSync("unzip", ["-p", epubPath, file], { encoding: "utf8" });
    const plain = stripHtml(raw);
    const all = plain
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sanitizeSentence(sentence))
      .filter(Boolean);

    for (let index = 0; index < all.length; index += 1) {
      const current = all[index];
      const next = all[index + 1] ?? "";

      if (current.length < 24 || current.length > 220) {
        continue;
      }

      rows.push({
        sentence: current,
        nextSentence: next,
        source
      });
    }
  }

  return rows;
}

function mutateNegationToFake(sentence) {
  for (const rule of NEGATION_RULES) {
    if (!rule.pattern.test(sentence)) {
      continue;
    }

    let fake = sentence.replace(rule.pattern, rule.replacement);
    fake = fake.replace(/\bat all\b/gi, "").replace(/\s{2,}/g, " ").trim();

    return {
      fake: sanitizeSentence(fake),
      correction: sanitizeSentence(sentence),
      mutationTag: rule.tag
    };
  }

  return null;
}

function extractMythCueCandidate(sentence, nextSentence) {
  for (const pattern of MYTH_CUE_PATTERNS) {
    const match = sentence.match(pattern);

    if (!match) {
      continue;
    }

    let claim = sanitizeSentence(match[1] ?? "")
      .replace(/^that\s+/i, "")
      .replace(/^the idea that\s+/i, "")
      .replace(/\b(is|was)\s+(false|incorrect|wrong)\b.*$/i, "")
      .trim();

    claim = ensureTerminalPeriod(claim);

    if (!claim || wordsCount(claim) < 6 || wordsCount(claim) > 24) {
      continue;
    }

    let correction = sanitizeSentence(sentence);

    if (nextSentence) {
      const next = sanitizeSentence(nextSentence);
      const nextWords = wordsCount(next);

      if (nextWords >= 6 && nextWords <= 28 && isLikelyStandaloneSentence(next) && !/^What\b/.test(next)) {
        correction = next;
      }
    }

    return {
      fake: claim,
      correction,
      mutationTag: "myth-cue"
    };
  }

  return null;
}

function buildRawCandidates(rows) {
  const candidates = [];
  const seen = new Set();

  function maybePushCandidate(fakeEn, correctionEn, source, mutationTag) {
    if (!fakeEn || !correctionEn) {
      return;
    }

    if (wordsCount(fakeEn) > 24 || wordsCount(correctionEn) > 30) {
      return;
    }

    if (normalizeForKey(fakeEn) === normalizeForKey(correctionEn)) {
      return;
    }

    if (!passesCardStyleRules(fakeEn, correctionEn)) {
      return;
    }

    const dedupeKey = `${normalizeForKey(fakeEn)}||${normalizeForKey(correctionEn)}`;

    if (!dedupeKey || seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);

    const category = detectCategory(correctionEn);
    const score = qualityScore(fakeEn, correctionEn);

    candidates.push({
      fakeEn,
      correctionEn,
      category,
      source,
      mutationTag,
      score
    });
  }

  for (const row of rows) {
    for (const sentence of sentenceVariants(row.sentence)) {
      if (!isLikelyStandaloneSentence(sentence)) {
        continue;
      }

      const mutated = mutateNegationToFake(sentence);

      if (!mutated) {
        const mythCue = extractMythCueCandidate(sentence, row.nextSentence);

        if (mythCue) {
          maybePushCandidate(
            sanitizeSentence(mythCue.fake),
            sanitizeSentence(mythCue.correction),
            row.source,
            mythCue.mutationTag
          );
        }

        continue;
      }

      const fakeEn = sanitizeSentence(mutated.fake);
      let correctionEn = sanitizeSentence(mutated.correction);

      if (row.nextSentence && /^\s*(In fact|Actually|However|Instead|Rather)\b/i.test(row.nextSentence)) {
        const maybeBetter = trimToWordLimit(sanitizeSentence(row.nextSentence), 24);

        if (isLikelyStandaloneSentence(maybeBetter) && wordsCount(maybeBetter) >= 6) {
          correctionEn = maybeBetter;
        }
      }

      maybePushCandidate(fakeEn, correctionEn, row.source, mutated.mutationTag);
    }
  }

  return candidates;
}

function loadTranslationCache(cachePath) {
  if (!existsSync(cachePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(cachePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function translateEnglishToRussian(text) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", "ru");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  for (let attempt = 1; attempt <= translationRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), translationTimeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "facts-curation-script/1.0"
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Translation request failed with status ${response.status}`);
      }

      const payload = await response.json();
      const translated = Array.isArray(payload?.[0])
        ? payload[0].map((part) => (Array.isArray(part) ? String(part[0] ?? "") : "")).join("")
        : "";
      const normalized = normalizeText(translated);

      if (!normalized) {
        throw new Error("Translation response is empty");
      }

      return normalized;
    } catch (error) {
      clearTimeout(timeout);

      if (attempt === translationRetries) {
        throw error;
      }
    }
  }

  return [];
}

async function translateChunkEnglishToRussian(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const output = [];

  for (const text of texts) {
    output.push(await translateEnglishToRussian(text));
  }

  return output;
}

async function hydrateTranslations(cache, strings) {
  const uniqueMissing = [...new Set(strings.map((value) => normalizeText(value)).filter(Boolean))].filter(
    (value) => !cache[value]
  );

  if (uniqueMissing.length === 0) {
    return;
  }

  if (offlineTranslationOnly) {
    console.warn(`Skipping online translation for ${uniqueMissing.length} strings (OFFLINE_TRANSLATION_ONLY=1).`);
    return;
  }

  for (let index = 0; index < uniqueMissing.length; index += translationBatchSize) {
    const chunk = uniqueMissing.slice(index, index + translationBatchSize);
    const translated = await translateChunkEnglishToRussian(chunk);

    for (let itemIndex = 0; itemIndex < chunk.length; itemIndex += 1) {
      const source = chunk[itemIndex];
      const target = normalizeText(translated[itemIndex] ?? "");

      if (source && target && hasCyrillic(target) && isFamilyFriendlyRussian(target)) {
        cache[source] = target;
      }
    }

    if ((index / translationBatchSize + 1) % 20 === 0) {
      console.log(`Translated ${Math.min(index + translationBatchSize, uniqueMissing.length)} / ${uniqueMissing.length}`);
    }
  }
}

function toFinalCards(candidates, cache, target) {
  const selected = [];
  const seenText = new Set();

  const sorted = [...candidates].sort((first, second) => {
    const scoreDelta = second.score - first.score;

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return first.fakeEn.localeCompare(second.fakeEn);
  });

  for (const candidate of sorted) {
    if (selected.length >= target) {
      break;
    }

    const fakeEn = normalizeText(candidate.fakeEn);
    const correctionEn = normalizeText(candidate.correctionEn);
    const fakeRu = normalizeText(cache[fakeEn] ?? "");
    const correctionRu = normalizeText(cache[correctionEn] ?? "");
    const key = normalizeForKey(fakeEn);

    if (!fakeRu || !correctionRu || !hasCyrillic(fakeRu) || !hasCyrillic(correctionRu)) {
      continue;
    }

    if (!isFamilyFriendlyRussian(fakeRu) || !isFamilyFriendlyRussian(correctionRu)) {
      continue;
    }

    if (!passesCardStyleRules(fakeEn, correctionEn)) {
      continue;
    }

    if (seenText.has(key)) {
      continue;
    }

    seenText.add(key);
    selected.push(candidate);
  }

  return selected.map((candidate, index) => {
    const fakeEn = normalizeText(candidate.fakeEn);
    const correctionEn = normalizeText(candidate.correctionEn);
    const fakeRu = normalizeText(cache[fakeEn]);
    const correctionRu = normalizeText(cache[correctionEn]);
    const categoryTag = normalizeTag(candidate.category.en);

    return {
      id: `epub-${candidate.source.code}-fake-${String(index + 1).padStart(4, "0")}`,
      category: candidate.category,
      text: {
        en: fakeEn,
        ru: fakeRu
      },
      correction: {
        en: correctionEn,
        ru: correctionRu
      },
      metadata: {
        qualityTier: "curated",
        sourceType: "book_extract",
        verificationStatus: "verified",
        familyFriendly: true,
        reviewedAt,
        verifiedAt: reviewedAt,
        source: {
          name: candidate.source.name,
          url: candidate.source.url
        },
        tags: [
          "myth",
          "book-extract",
          "family-friendly",
          categoryTag,
          `book-${candidate.source.code}`
        ],
        notes: `Curated from ${candidate.source.name}; negation-based myth extraction with editorial filters.`
      }
    };
  });
}

async function main() {
  const config = parseArgs();
  const cache = loadTranslationCache(config.cachePath);
  const rows = [];

  for (const epubPath of config.epubPaths) {
    const extracted = loadSentencesFromEpub(epubPath);
    rows.push(...extracted);
    console.log(`Loaded ${extracted.length} candidate sentences from ${epubPath}`);
  }

  const rawCandidates = buildRawCandidates(rows);
  const stringsToTranslate = [];

  for (const candidate of rawCandidates) {
    stringsToTranslate.push(candidate.fakeEn, candidate.correctionEn);
  }

  console.log(`Raw book-derived fake candidates: ${rawCandidates.length}`);
  await hydrateTranslations(cache, stringsToTranslate);

  const finalFakeFacts = toFinalCards(rawCandidates, cache, config.target);

  const output = {
    generatedAt: new Date().toISOString(),
    sourceBooks: config.epubPaths,
    extractionMode: "multi-epub-negation-curated",
    targetFakeCount: config.target,
    rawCandidateCount: rawCandidates.length,
    selectedFakeCount: finalFakeFacts.length,
    fakeFacts: finalFakeFacts
  };

  writeFileSync(config.outputPath, JSON.stringify(output, null, 2), "utf8");
  writeFileSync(config.cachePath, JSON.stringify(cache, null, 2), "utf8");

  console.log(`Saved ${finalFakeFacts.length} curated fake cards to ${config.outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
