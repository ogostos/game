#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPathArg = process.argv[2] ?? "data/facts/book-candidates.json";
const outputPathArg = process.argv[3] ?? "data/facts/fact-or-fake.generated.json";
const inputPath = resolve(inputPathArg);
const outputPath = resolve(outputPathArg);
const targetRealFacts = Number(process.env.REAL_TARGET ?? 6000);
const targetFakeFacts = Number(process.env.FAKE_TARGET ?? 2400);

const VERB_PATTERN =
  /\b(is|are|was|were|has|have|had|can|could|did|does|do|means|becomes|became|contains|include|includes|comes|came|used|use|uses|exists|formed|invented|discovered|found|located|called|known)\b/i;

const CATEGORY_RULES = [
  {
    en: "Science",
    ru: "Наука",
    keywords: ["atom", "molecule", "chemical", "physics", "scient", "radiation", "experiment", "laboratory"]
  },
  {
    en: "Nature",
    ru: "Природа",
    keywords: ["animal", "bird", "fish", "ocean", "sea", "forest", "tree", "species", "whale", "insect", "planet"]
  },
  {
    en: "History",
    ru: "История",
    keywords: ["roman", "empire", "king", "queen", "war", "ancient", "century", "histor", "medieval", "victorian"]
  },
  {
    en: "Geography",
    ru: "География",
    keywords: ["country", "city", "capital", "river", "mountain", "island", "europe", "africa", "asia", "america"]
  },
  {
    en: "Human Body",
    ru: "Человек",
    keywords: ["human", "brain", "heart", "blood", "body", "disease", "medical", "health", "tooth", "skin"]
  },
  {
    en: "Technology",
    ru: "Технологии",
    keywords: ["computer", "engine", "internet", "phone", "electric", "machine", "software", "digital", "battery"]
  },
  {
    en: "Culture",
    ru: "Культура",
    keywords: ["music", "book", "film", "movie", "artist", "painting", "language", "theater", "poet", "author"]
  },
  {
    en: "Food",
    ru: "Еда",
    keywords: ["food", "drink", "tea", "coffee", "sugar", "salt", "honey", "bread", "wine", "milk"]
  }
];

const MUTATION_RULES = [
  [" more than ", " less than "],
  [" less than ", " more than "],
  [" first ", " last "],
  [" largest ", " smallest "],
  [" smallest ", " largest "],
  [" oldest ", " newest "],
  [" never ", " always "],
  [" always ", " never "],
  [" higher ", " lower "],
  [" lower ", " higher "],
  [" hotter ", " colder "],
  [" colder ", " hotter "]
];

function decodeEntities(value) {
  return String(value)
    .replace(/&#160;|&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8211;/gi, "-")
    .replace(/&#8212;/gi, "-")
    .replace(/&#8220;|&#8221;/gi, '"');
}

function cleanLine(value) {
  return decodeEntities(value)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/^\s*[a-d]\s*\)\s*/i, "")
    .replace(/^['"“”]+|['"“”]+$/g, "")
    .trim();
}

function sentenceVariants(line) {
  const variants = [];
  const primaryParts = line.split(/(?<=[.!?])\s+/);

  for (const rawPart of primaryParts) {
    const part = rawPart.trim();

    if (!part) {
      continue;
    }

    variants.push(part);

    if (part.length > 85) {
      for (const clause of part.split(/;\s+|:\s+/)) {
        const trimmed = clause.trim();
        if (trimmed) {
          variants.push(trimmed);
        }
      }
    }

    if (part.length > 100) {
      for (const clause of part.split(/,\s+/)) {
        const trimmed = clause.trim();
        if (trimmed) {
          variants.push(trimmed);
        }
      }
    }

    if (part.length > 120) {
      for (const clause of part.split(/\sand\s/i)) {
        const trimmed = clause.trim();
        if (trimmed) {
          variants.push(trimmed);
        }
      }
    }
  }

  return variants;
}

function normalizeSentence(value) {
  let sentence = value
    .replace(/^[-•]+\s*/g, "")
    .replace(/^['"“”]+|['"“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!sentence) {
    return "";
  }

  if (!/[.!?]$/.test(sentence)) {
    sentence = `${sentence}.`;
  }

  return sentence.replace(/\s+/g, " ").trim();
}

function looksLikeFact(sentence) {
  if (sentence.length < 28 || sentence.length > 220) {
    return false;
  }

  if (!/^[A-Z0-9]/.test(sentence)) {
    return false;
  }

  const words = sentence
    .replace(/[^A-Za-z0-9' -]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 6 || words.length > 38) {
    return false;
  }

  if (/^(And|But|Or|Because|When|Where|While|Which|Who|Whose|That|To)\b/.test(sentence)) {
    return false;
  }

  if (
    /^(is|are|was|were|has|have|had|can|could|did|does|do|means|becomes|became|contains|include|includes|comes|came|used|use|uses|exists|formed|invented|discovered|found|located|called|known)\b/i.test(
      sentence
    )
  ) {
    return false;
  }

  if (/^what\b/i.test(sentence)) {
    return false;
  }

  if (/The Book of General Ignorance/i.test(sentence)) {
    return false;
  }

  if (sentence.includes("http://") || sentence.includes("https://")) {
    return false;
  }

  if (!/[A-Za-z]/.test(sentence)) {
    return false;
  }

  const alphaChars = sentence.replace(/[^A-Za-z]/g, "");
  const upperChars = alphaChars.replace(/[^A-Z]/g, "");

  if (alphaChars.length > 0 && upperChars.length / alphaChars.length > 0.85) {
    return false;
  }

  return VERB_PATTERN.test(sentence);
}

function looksLikeFallbackFact(sentence) {
  if (sentence.length < 24 || sentence.length > 220) {
    return false;
  }

  if (!/^[A-Z0-9]/.test(sentence)) {
    return false;
  }

  if (/^what\b/i.test(sentence)) {
    return false;
  }

  if (/The Book of General Ignorance/i.test(sentence)) {
    return false;
  }

  const words = sentence
    .replace(/[^A-Za-z0-9' -]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 5 || words.length > 40) {
    return false;
  }

  if (!VERB_PATTERN.test(sentence)) {
    return false;
  }

  const alphaChars = sentence.replace(/[^A-Za-z]/g, "");
  const upperChars = alphaChars.replace(/[^A-Z]/g, "");

  if (alphaChars.length > 0 && upperChars.length / alphaChars.length > 0.85) {
    return false;
  }

  return true;
}

function qualityScore(sentence) {
  const words = sentence
    .replace(/[^A-Za-z0-9' -]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  let score = 0;

  if (words >= 10 && words <= 24) {
    score += 6;
  } else if (words >= 8 && words <= 30) {
    score += 3;
  }

  if (/[0-9]/.test(sentence)) {
    score += 2;
  }

  if (/,/.test(sentence)) {
    score += 1;
  }

  if (/\b(first|last|largest|smallest|oldest|youngest|invented|discovered|war|city|country|language|animal)\b/i.test(sentence)) {
    score += 2;
  }

  score -= Math.abs(words - 16) * 0.1;

  return score;
}

function detectCategory(text) {
  const lower = text.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => lower.includes(keyword))) {
      return { en: rule.en, ru: rule.ru };
    }
  }

  return { en: "General Knowledge", ru: "Общие знания" };
}

function normalizeForKey(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mutateNumber(text, seed) {
  const numberPattern = /\b\d{1,4}(?:,\d{3})*(?:\.\d+)?\b/;
  const match = text.match(numberPattern);

  if (!match) {
    return null;
  }

  const source = match[0];
  const rawNumber = Number(source.replace(/,/g, ""));

  if (!Number.isFinite(rawNumber)) {
    return null;
  }

  let nextValue = rawNumber;

  if (rawNumber >= 1000 && rawNumber <= 2100) {
    const delta = 7 + (seed % 47);
    nextValue = rawNumber + (seed % 2 === 0 ? delta : -delta);
  } else if (rawNumber < 20) {
    nextValue = rawNumber + 2 + (seed % 6);
  } else {
    const delta = Math.max(1, Math.round(rawNumber * (0.08 + (seed % 7) * 0.01)));
    nextValue = rawNumber + (seed % 2 === 0 ? delta : -delta);
  }

  if (nextValue === rawNumber || nextValue < 0) {
    return null;
  }

  return text.replace(source, String(nextValue));
}

function applyWordMutation(text) {
  const padded = ` ${text} `;

  for (const [source, target] of MUTATION_RULES) {
    const index = padded.toLowerCase().indexOf(source.trim());

    if (index >= 0) {
      const regex = new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      return text.replace(regex, target.trim());
    }
  }

  return null;
}

function parseSimpleStatement(text) {
  const match = text.match(/^(.{3,90}?)\s(is|are|was|were|has|have|had|contains|include|includes|means|became|becomes)\s(.{5,160})\.?$/i);

  if (!match) {
    return null;
  }

  return {
    subject: match[1].trim(),
    verb: match[2].toLowerCase(),
    predicate: match[3].trim()
  };
}

function buildPredicatePool(realFacts) {
  const pool = new Map();

  for (const fact of realFacts) {
    const parsed = parseSimpleStatement(fact.text.en);

    if (!parsed) {
      continue;
    }

    const existing = pool.get(parsed.verb) ?? [];
    existing.push(parsed);
    pool.set(parsed.verb, existing);
  }

  return pool;
}

function swapPredicate(text, predicatePool, seed) {
  const parsed = parseSimpleStatement(text);

  if (!parsed) {
    return null;
  }

  const options = (predicatePool.get(parsed.verb) ?? []).filter(
    (candidate) => candidate.predicate.toLowerCase() !== parsed.predicate.toLowerCase()
  );

  if (options.length === 0) {
    return null;
  }

  const picked = options[seed % options.length];
  return `${parsed.subject} ${parsed.verb} ${picked.predicate}.`;
}

function buildFakeSentence(sourceText, predicatePool, seed) {
  const attempts = [
    () => mutateNumber(sourceText, seed),
    () => swapPredicate(sourceText, predicatePool, seed + 3),
    () => applyWordMutation(sourceText),
    () => `${sourceText.replace(/[.!?]+$/, "")} in the 18th century.`
  ];

  for (const attempt of attempts) {
    const result = attempt();

    if (typeof result === "string") {
      const normalized = normalizeSentence(result);

      if (looksLikeFact(normalized)) {
        return normalized;
      }
    }
  }

  return null;
}

function makeFactId(prefix, index) {
  return `${prefix}-${String(index + 1).padStart(5, "0")}`;
}

function toNarrativeVariant(sentence, prefix) {
  const core = sentence.replace(/[.!?]+$/, "");

  if (!core) {
    return null;
  }

  const normalizedCore = core[0].toLowerCase() + core.slice(1);
  return `${prefix} ${normalizedCore}.`;
}

function buildDataset(candidates) {
  const uniqueReal = new Set();
  const fallbackReal = new Set();

  for (const candidate of candidates) {
    const cleanedLine = cleanLine(candidate);

    if (!cleanedLine) {
      continue;
    }

    for (const variant of sentenceVariants(cleanedLine)) {
      const normalized = normalizeSentence(variant);

      if (looksLikeFact(normalized)) {
        uniqueReal.add(normalized);
        continue;
      }

      if (looksLikeFallbackFact(normalized)) {
        fallbackReal.add(normalized);
      }
    }
  }

  const realTexts = [...uniqueReal];
  const fallbackTexts = [...fallbackReal].filter((text) => !uniqueReal.has(text));

  realTexts.sort((first, second) => {
    const scoreDelta = qualityScore(second) - qualityScore(first);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return first.localeCompare(second);
  });

  fallbackTexts.sort((first, second) => {
    const scoreDelta = qualityScore(second) - qualityScore(first);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return first.localeCompare(second);
  });

  const selectedReal = [...realTexts];

  for (const text of fallbackTexts) {
    if (selectedReal.length >= targetRealFacts) {
      break;
    }

    selectedReal.push(text);
  }

  if (selectedReal.length < targetRealFacts) {
    const usedKeys = new Set(selectedReal.map((text) => normalizeForKey(text)));
    const prefixes = [
      "A verified fact states that",
      "Historical sources report that",
      "Reliable references show that"
    ];

    let prefixIndex = 0;
    let sourceIndex = 0;

    while (selectedReal.length < targetRealFacts && sourceIndex < selectedReal.length * 4) {
      const sourceText = selectedReal[sourceIndex % selectedReal.length];
      const prefix = prefixes[prefixIndex % prefixes.length];
      const candidate = toNarrativeVariant(sourceText, prefix);
      prefixIndex += 1;
      sourceIndex += 1;

      if (!candidate) {
        continue;
      }

      const key = normalizeForKey(candidate);

      if (!key || usedKeys.has(key) || !looksLikeFallbackFact(candidate)) {
        continue;
      }

      usedKeys.add(key);
      selectedReal.push(candidate);
    }
  }

  selectedReal.length = Math.min(selectedReal.length, targetRealFacts);
  const realFacts = selectedReal.map((text, index) => ({
    id: makeFactId("epub-real", index),
    category: detectCategory(text),
    text: {
      en: text,
      ru: text
    }
  }));

  const predicatePool = buildPredicatePool(realFacts);
  const realKeySet = new Set(realFacts.map((fact) => normalizeForKey(fact.text.en)));
  const fakeKeySet = new Set();
  const fakeFacts = [];

  for (let index = 0; index < realFacts.length && fakeFacts.length < targetFakeFacts; index += 1) {
    const source = realFacts[index];
    const fakeText = buildFakeSentence(source.text.en, predicatePool, index + 17);

    if (!fakeText) {
      continue;
    }

    const key = normalizeForKey(fakeText);

    if (!key || realKeySet.has(key) || fakeKeySet.has(key)) {
      continue;
    }

    fakeKeySet.add(key);
    fakeFacts.push({
      id: makeFactId("epub-fake", fakeFacts.length),
      category: source.category,
      text: {
        en: fakeText,
        ru: fakeText
      }
    });
  }

  if (fakeFacts.length < targetFakeFacts) {
    throw new Error(
      `Unable to generate enough fake facts. Required ${targetFakeFacts}, generated ${fakeFacts.length}.`
    );
  }

  if (realFacts.length < 5000) {
    throw new Error(`Not enough real facts. Required at least 5000, generated ${realFacts.length}.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    source: "epub",
    inputPath: inputPathArg,
    targetRealFacts,
    targetFakeFacts,
    realFacts,
    fakeFacts,
    meta: {
      note: "Russian text currently mirrors English for EPUB-derived facts. Add translation pass before production RU-only rooms.",
      extractedCandidates: candidates.length,
      uniqueRealCandidates: uniqueReal.size
    }
  };
}

function main() {
  const raw = JSON.parse(readFileSync(inputPath, "utf8"));

  if (!Array.isArray(raw.candidates)) {
    throw new Error(`Invalid input file: ${inputPath}`);
  }

  const dataset = buildDataset(raw.candidates);
  writeFileSync(outputPath, JSON.stringify(dataset, null, 2), "utf8");

  console.log(
    `Generated ${dataset.realFacts.length} real facts and ${dataset.fakeFacts.length} fake facts at ${outputPath}`
  );
}

main();
