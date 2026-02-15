#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "data/facts/fact-or-fake.generated.json");
const perTemplateLimit = Number(process.env.WIKIDATA_LIMIT ?? 700);
const fakeTarget = Number(process.env.WIKIDATA_FAKE_TARGET ?? 2600);
const endpoint = "https://query.wikidata.org/sparql";
const userAgent = "imposter-game-box/0.1 (facts import script)";

const templates = [
  {
    id: "country-capital",
    category: { en: "Geography", ru: "География" },
    where: "?subject wdt:P31 wd:Q6256; wdt:P36 ?value .",
    toText: {
      en: (subject, value) => `The capital of ${subject} is ${value}.`,
      ru: (subject, value) => `Столица страны ${subject} — ${value}.`
    }
  },
  {
    id: "country-currency",
    category: { en: "Economy", ru: "Экономика" },
    where: "?subject wdt:P31 wd:Q6256; wdt:P38 ?value .",
    toText: {
      en: (subject, value) => `The currency of ${subject} is ${value}.`,
      ru: (subject, value) => `Валюта страны ${subject} — ${value}.`
    }
  },
  {
    id: "city-country",
    category: { en: "Geography", ru: "География" },
    where: "?subject wdt:P31/wdt:P279* wd:Q515; wdt:P17 ?value .",
    toText: {
      en: (subject, value) => `${subject} is in ${value}.`,
      ru: (subject, value) => `${subject} находится в стране ${value}.`
    }
  },
  {
    id: "mountain-country",
    category: { en: "Nature", ru: "Природа" },
    where: "?subject wdt:P31/wdt:P279* wd:Q8502; wdt:P17 ?value .",
    toText: {
      en: (subject, value) => `${subject} is located in ${value}.`,
      ru: (subject, value) => `${subject} находится в ${value}.`
    }
  },
  {
    id: "river-mouth",
    category: { en: "Nature", ru: "Природа" },
    where: "?subject wdt:P31/wdt:P279* wd:Q4022; wdt:P403 ?value .",
    toText: {
      en: (subject, value) => `${subject} flows into ${value}.`,
      ru: (subject, value) => `${subject} впадает в ${value}.`
    }
  },
  {
    id: "language-script",
    category: { en: "Language", ru: "Язык" },
    where: "?subject wdt:P31 wd:Q34770; wdt:P282 ?value .",
    toText: {
      en: (subject, value) => `${subject} uses the ${value} writing system.`,
      ru: (subject, value) => `Для языка ${subject} используется письменность ${value}.`
    }
  },
  {
    id: "book-author",
    category: { en: "Culture", ru: "Культура" },
    where: "?subject wdt:P31 wd:Q571; wdt:P50 ?value .",
    toText: {
      en: (subject, value) => `${subject} was written by ${value}.`,
      ru: (subject, value) => `Произведение ${subject} написал(а) ${value}.`
    }
  },
  {
    id: "film-director",
    category: { en: "Cinema", ru: "Кино" },
    where: "?subject wdt:P31 wd:Q11424; wdt:P57 ?value .",
    toText: {
      en: (subject, value) => `${subject} was directed by ${value}.`,
      ru: (subject, value) => `Фильм ${subject} снял(а) ${value}.`
    }
  }
];

function sleep(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

function normalized(text) {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getEntityId(uri) {
  const value = String(uri || "");
  const index = value.lastIndexOf("/");
  return index >= 0 ? value.slice(index + 1) : value;
}

function parseBinding(binding) {
  const subject = binding.subject?.value;
  const value = binding.value?.value;
  const subjectLabelEn = binding.subjectLabelEn?.value;
  const subjectLabelRu = binding.subjectLabelRu?.value;
  const valueLabelEn = binding.valueLabelEn?.value;
  const valueLabelRu = binding.valueLabelRu?.value;

  if (!subject || !value || !subjectLabelEn || !subjectLabelRu || !valueLabelEn || !valueLabelRu) {
    return null;
  }

  return {
    subject,
    value,
    subjectLabelEn,
    subjectLabelRu,
    valueLabelEn,
    valueLabelRu
  };
}

function buildQuery(whereClause, limit) {
  return `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?subject ?value ?subjectLabelEn ?subjectLabelRu ?valueLabelEn ?valueLabelRu WHERE {
  ${whereClause}
  FILTER(?subject != ?value)

  ?subject rdfs:label ?subjectLabelEn .
  FILTER(LANG(?subjectLabelEn) = "en")

  ?subject rdfs:label ?subjectLabelRu .
  FILTER(LANG(?subjectLabelRu) = "ru")

  ?value rdfs:label ?valueLabelEn .
  FILTER(LANG(?valueLabelEn) = "en")

  ?value rdfs:label ?valueLabelRu .
  FILTER(LANG(?valueLabelRu) = "ru")
}
LIMIT ${limit}
`;
}

async function runSparql(query) {
  const params = new URLSearchParams();
  params.set("query", query);

  let attempts = 0;

  while (attempts < 4) {
    attempts += 1;

    try {
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        headers: {
          accept: "application/sparql-results+json",
          "user-agent": userAgent
        }
      });

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 429 || response.status >= 500) {
          await sleep(1200 * attempts);
          continue;
        }

        throw new Error(`SPARQL request failed (${response.status}): ${body.slice(0, 240)}`);
      }

      return response.json();
    } catch (error) {
      if (attempts >= 4) {
        throw error;
      }

      await sleep(1200 * attempts);
    }
  }

  throw new Error("SPARQL request failed after retries.");
}

function ensureDatasetShape(value) {
  if (!value || typeof value !== "object") {
    return {
      generatedAt: new Date().toISOString(),
      source: "combined",
      realFacts: [],
      fakeFacts: []
    };
  }

  const candidate = value;
  const realFacts = Array.isArray(candidate.realFacts) ? candidate.realFacts : [];
  const fakeFacts = Array.isArray(candidate.fakeFacts) ? candidate.fakeFacts : [];

  return {
    ...candidate,
    realFacts,
    fakeFacts
  };
}

function makeRealFact(template, row) {
  const subjectId = getEntityId(row.subject);
  const valueId = getEntityId(row.value);

  return {
    id: `wd-real-${template.id}-${subjectId}-${valueId}`,
    category: template.category,
    text: {
      en: template.toText.en(row.subjectLabelEn, row.valueLabelEn),
      ru: template.toText.ru(row.subjectLabelRu, row.valueLabelRu)
    },
    _templateId: template.id,
    _subjectId: subjectId,
    _valueId: valueId,
    _subjectLabelEn: row.subjectLabelEn,
    _subjectLabelRu: row.subjectLabelRu,
    _valueLabelEn: row.valueLabelEn,
    _valueLabelRu: row.valueLabelRu
  };
}

function makeFakeFact(template, baseFact, altFact) {
  return {
    id: `wd-fake-${template.id}-${baseFact._subjectId}-${altFact._valueId}`,
    category: template.category,
    text: {
      en: template.toText.en(baseFact._subjectLabelEn, altFact._valueLabelEn),
      ru: template.toText.ru(baseFact._subjectLabelRu, altFact._valueLabelRu)
    }
  };
}

function removeInternals(fact) {
  return {
    id: fact.id,
    category: fact.category,
    text: fact.text
  };
}

function dedupeFactsByIdAndText(facts) {
  const seenIds = new Set();
  const seenTexts = new Set();
  const output = [];

  for (const fact of facts) {
    if (!fact || typeof fact !== "object") {
      continue;
    }

    if (!fact.id || !fact.text?.en || !fact.text?.ru) {
      continue;
    }

    const textKey = normalized(`${fact.text.en}||${fact.text.ru}`);

    if (seenIds.has(fact.id) || seenTexts.has(textKey)) {
      continue;
    }

    seenIds.add(fact.id);
    seenTexts.add(textKey);
    output.push(fact);
  }

  return output;
}

async function main() {
  const existingRaw = (() => {
    try {
      return JSON.parse(readFileSync(outputPath, "utf8"));
    } catch {
      return {};
    }
  })();

  const existingDataset = ensureDatasetShape(existingRaw);
  const realFacts = [];

  for (const template of templates) {
    const query = buildQuery(template.where, perTemplateLimit);
    const result = await runSparql(query);
    const rows = Array.isArray(result?.results?.bindings) ? result.results.bindings : [];

    for (const binding of rows) {
      const parsed = parseBinding(binding);

      if (!parsed) {
        continue;
      }

      realFacts.push(makeRealFact(template, parsed));
    }

    await sleep(500);
  }

  const dedupedRealFacts = dedupeFactsByIdAndText(realFacts);
  const realByTemplate = new Map();

  for (const fact of dedupedRealFacts) {
    const key = fact._templateId;
    const list = realByTemplate.get(key) ?? [];
    list.push(fact);
    realByTemplate.set(key, list);
  }

  const realTextKeys = new Set(dedupedRealFacts.map((fact) => normalized(fact.text.en)));
  const generatedFake = [];
  const fakeTextKeys = new Set();

  for (const template of templates) {
    const list = realByTemplate.get(template.id) ?? [];

    if (list.length < 2) {
      continue;
    }

    for (let index = 0; index < list.length && generatedFake.length < fakeTarget; index += 1) {
      const baseFact = list[index];
      const alternatives = list.filter((candidate) => candidate._valueId !== baseFact._valueId);

      if (alternatives.length === 0) {
        continue;
      }

      const picked = alternatives[(index * 11 + 3) % alternatives.length];
      const fake = makeFakeFact(template, baseFact, picked);
      const textKey = normalized(fake.text.en);

      if (realTextKeys.has(textKey) || fakeTextKeys.has(textKey)) {
        continue;
      }

      fakeTextKeys.add(textKey);
      generatedFake.push(fake);
    }
  }

  const nextRealFacts = dedupeFactsByIdAndText([
    ...existingDataset.realFacts,
    ...dedupedRealFacts.map((fact) => removeInternals(fact))
  ]);
  const nextFakeFacts = dedupeFactsByIdAndText([...existingDataset.fakeFacts, ...generatedFake]);

  const output = {
    ...existingDataset,
    generatedAt: new Date().toISOString(),
    source: "epub+wikipedia",
    realFacts: nextRealFacts,
    fakeFacts: nextFakeFacts,
    meta: {
      ...(existingDataset.meta ?? {}),
      wikidataImportedAt: new Date().toISOString(),
      wikidataTemplates: templates.map((template) => template.id),
      wikidataLimitPerTemplate: perTemplateLimit
    }
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log(`Wikidata import complete. Real facts: ${output.realFacts.length}, fake facts: ${output.fakeFacts.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
