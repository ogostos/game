import curatedFactsSource from "@/data/facts/fact-or-fake.curated.json";
import epubFakesSource from "@/data/facts/fact-or-fake.epub-fakes.json";
import type {
  FactCard,
  FactCardMetadata,
  FactDeck,
  FactKind,
  FactSourceReference,
  Language
} from "@/lib/shared/types";

interface BilingualText {
  en: string;
  ru: string;
}

interface BilingualFactPair {
  id: string;
  category: BilingualText;
  realFact: BilingualText;
  fakeFact: BilingualText;
  fakeCorrection?: BilingualText;
}

interface PairMetadata {
  source: FactSourceReference;
  tags: string[];
  notes?: string;
}

interface CuratedFactSource {
  id: string;
  category: BilingualText;
  text: BilingualText;
  correction?: BilingualText;
}

interface CuratedFactsPayload {
  realFacts?: CuratedFactSource[];
  fakeFacts?: CuratedFactSource[];
}

interface FactSource {
  id: string;
  category: BilingualText;
  text: BilingualText;
  correction?: BilingualText;
  kind: FactKind;
  metadata: FactCardMetadata;
}

const FACT_OR_FAKE_SOURCE: BilingualFactPair[] = [
  {
    id: "ff-001",
    category: { en: "Nature", ru: "Природа" },
    realFact: {
      en: "Octopuses have three hearts and blue blood.",
      ru: "У осьминога три сердца и голубая кровь."
    },
    fakeFact: {
      en: "Octopuses can survive two weeks out of water by storing oxygen in their tentacles.",
      ru: "Осьминог может прожить две недели без воды благодаря запасу кислорода в щупальцах."
    }
  },
  {
    id: "ff-002",
    category: { en: "History", ru: "История" },
    realFact: {
      en: "The shortest war in history lasted about 38 minutes.",
      ru: "Самая короткая война в истории длилась около 38 минут."
    },
    fakeFact: {
      en: "Napoleon once sold the Eiffel Tower to fund a military campaign.",
      ru: "Наполеон продал Эйфелеву башню, чтобы финансировать военную кампанию."
    }
  },
  {
    id: "ff-003",
    category: { en: "Space", ru: "Космос" },
    realFact: {
      en: "A day on Venus is longer than a year on Venus.",
      ru: "Сутки на Венере длиннее, чем год на Венере."
    },
    fakeFact: {
      en: "The Moon has active volcanoes that erupt every decade.",
      ru: "На Луне есть действующие вулканы, которые извергаются каждые 10 лет."
    }
  },
  {
    id: "ff-004",
    category: { en: "Animals", ru: "Животные" },
    realFact: {
      en: "Wombat poop is cube-shaped.",
      ru: "Помет вомбата имеет форму кубиков."
    },
    fakeFact: {
      en: "Penguins can identify their own egg by color pattern alone.",
      ru: "Пингвины узнают свое яйцо только по цветному узору скорлупы."
    }
  },
  {
    id: "ff-005",
    category: { en: "Food", ru: "Еда" },
    realFact: {
      en: "Honey can last for thousands of years without spoiling.",
      ru: "Мед может храниться тысячи лет и не портиться."
    },
    fakeFact: {
      en: "Salt has zero calories because the body cannot digest it at all.",
      ru: "Соль не содержит калорий, потому что организм вообще не способен ее усвоить."
    }
  },
  {
    id: "ff-006",
    category: { en: "Science", ru: "Наука" },
    realFact: {
      en: "Bananas are naturally slightly radioactive due to potassium-40.",
      ru: "Бананы слегка радиоактивны из-за изотопа калия-40."
    },
    fakeFact: {
      en: "Carrots glow under UV light because of their vitamin A content.",
      ru: "Морковь светится под ультрафиолетом из-за витамина A."
    }
  },
  {
    id: "ff-007",
    category: { en: "Geography", ru: "География" },
    realFact: {
      en: "Canada has more lakes than the rest of the world combined.",
      ru: "В Канаде больше озер, чем во всех остальных странах вместе."
    },
    fakeFact: {
      en: "Iceland has no mosquitoes because volcanic soil repels them naturally.",
      ru: "В Исландии нет комаров, потому что вулканическая почва полностью их отпугивает."
    }
  },
  {
    id: "ff-008",
    category: { en: "Human Body", ru: "Человек" },
    realFact: {
      en: "Fingerprints form before birth and remain unique for life.",
      ru: "Отпечатки пальцев формируются до рождения и не меняются всю жизнь."
    },
    fakeFact: {
      en: "Humans stop forming new brain cells after age 25.",
      ru: "После 25 лет человек перестает формировать новые клетки мозга."
    }
  },
  {
    id: "ff-009",
    category: { en: "Technology", ru: "Технологии" },
    realFact: {
      en: "The first computer bug was an actual moth found in a machine.",
      ru: "Первый компьютерный баг был настоящей молью в реле машины."
    },
    fakeFact: {
      en: "Wi-Fi was invented before the incandescent light bulb.",
      ru: "Wi-Fi был изобретен раньше, чем электрическая лампа накаливания."
    }
  },
  {
    id: "ff-010",
    category: { en: "Language", ru: "Язык" },
    realFact: {
      en: "The word \"alphabet\" comes from the Greek letters alpha and beta.",
      ru: "Слово \"alphabet\" происходит от первых двух греческих букв: alpha и beta."
    },
    fakeFact: {
      en: "English is the only language with silent letters in common words.",
      ru: "Русский язык официально признан единственным языком в мире без немых букв."
    }
  },
  {
    id: "ff-011",
    category: { en: "Ocean", ru: "Океан" },
    realFact: {
      en: "More than 80% of the ocean remains poorly explored.",
      ru: "Более 80% мирового океана до сих пор исследовано слабо."
    },
    fakeFact: {
      en: "The Mariana Trench is warm at the bottom because of magma vents everywhere.",
      ru: "На дне Марианской впадины теплая вода из-за повсеместных магматических трещин."
    }
  },
  {
    id: "ff-012",
    category: { en: "Weather", ru: "Погода" },
    realFact: {
      en: "Lightning is about five times hotter than the surface of the Sun.",
      ru: "Молния примерно в пять раз горячее поверхности Солнца."
    },
    fakeFact: {
      en: "Thunder can only be heard up to one kilometer from a strike.",
      ru: "Гром слышен максимум в радиусе одного километра от удара молнии."
    }
  },
  {
    id: "ff-013",
    category: { en: "Art", ru: "Искусство" },
    realFact: {
      en: "The Mona Lisa has no clearly visible eyebrows.",
      ru: "На портрете Моны Лизы почти не видно бровей."
    },
    fakeFact: {
      en: "Van Gogh sold no paintings during his lifetime.",
      ru: "Ван Гог при жизни не продал ни одной картины."
    }
  },
  {
    id: "ff-014",
    category: { en: "Sports", ru: "Спорт" },
    realFact: {
      en: "Golf balls have dimples to reduce drag and improve lift.",
      ru: "Ямочки на мячах для гольфа уменьшают сопротивление воздуха."
    },
    fakeFact: {
      en: "Basketball hoops were originally 2.5 meters high and later raised.",
      ru: "Баскетбольные кольца изначально были на высоте 2,5 метра и позже подняты."
    }
  },
  {
    id: "ff-015",
    category: { en: "Transport", ru: "Транспорт" },
    realFact: {
      en: "The first speeding ticket was issued for driving 8 mph.",
      ru: "Первый штраф за превышение скорости выписали за скорость 8 миль в час."
    },
    fakeFact: {
      en: "Seat belts were first invented for horse-drawn carriages.",
      ru: "Ремни безопасности изначально придумали для конных экипажей."
    }
  },
  {
    id: "ff-016",
    category: { en: "Books", ru: "Книги" },
    realFact: {
      en: "The first novel typed on a typewriter is often cited as Tom Sawyer.",
      ru: "Первым романом, напечатанным на машинке, считают \"Приключения Тома Сойера\"."
    },
    fakeFact: {
      en: "Shakespeare wrote all his plays in strict story chronology.",
      ru: "Шекспир писал все пьесы строго в хронологическом порядке их событий."
    }
  },
  {
    id: "ff-017",
    category: { en: "Music", ru: "Музыка" },
    realFact: {
      en: "Mozart wrote his first music pieces at around age five.",
      ru: "Моцарт написал первые музыкальные произведения примерно в пять лет."
    },
    fakeFact: {
      en: "A standard piano always has exactly 100 keys.",
      ru: "Стандартное пианино во всем мире всегда имеет ровно 100 клавиш."
    }
  },
  {
    id: "ff-018",
    category: { en: "Math", ru: "Математика" },
    realFact: {
      en: "Zero was invented independently in multiple ancient civilizations.",
      ru: "Понятие нуля независимо появлялось в нескольких древних цивилизациях."
    },
    fakeFact: {
      en: "Pi has been proven to start repeating after one trillion digits.",
      ru: "Доказано, что число пи начинает повторяться после триллиона знаков."
    }
  },
  {
    id: "ff-019",
    category: { en: "Architecture", ru: "Архитектура" },
    realFact: {
      en: "The Great Wall of China is not visible from space with the naked eye.",
      ru: "Великую Китайскую стену нельзя увидеть невооруженным глазом из космоса."
    },
    fakeFact: {
      en: "The Leaning Tower of Pisa leans because one side is intentionally shorter.",
      ru: "Пизанская башня наклонена, потому что одну ее сторону строили короче намеренно."
    }
  },
  {
    id: "ff-020",
    category: { en: "Medicine", ru: "Медицина" },
    realFact: {
      en: "Aspirin was originally derived from willow bark.",
      ru: "Изначально аспирин получили из коры ивы."
    },
    fakeFact: {
      en: "The appendix has no known connection to the immune system.",
      ru: "Аппендикс не имеет никакой связи с иммунной системой."
    }
  },
  {
    id: "ff-021",
    category: { en: "Culture", ru: "Культура" },
    realFact: {
      en: "Square watermelons in Japan are grown in box-shaped molds.",
      ru: "Квадратные арбузы в Японии выращивают в специальных формах."
    },
    fakeFact: {
      en: "Fortune cookies were invented in ancient China and exported to the U.S.",
      ru: "Печенье с предсказаниями придумали в древнем Китае и оттуда экспортировали в США."
    }
  },
  {
    id: "ff-022",
    category: { en: "Biology", ru: "Биология" },
    realFact: {
      en: "Some turtles can absorb oxygen through their cloaca during hibernation.",
      ru: "Некоторые черепахи во время зимовки могут получать кислород через клоаку."
    },
    fakeFact: {
      en: "Chameleons only change color to match their background.",
      ru: "Хамелеоны меняют цвет только чтобы сливаться с фоном."
    }
  },
  {
    id: "ff-023",
    category: { en: "Economics", ru: "Экономика" },
    realFact: {
      en: "Early forms of income tax existed in Ancient Egypt.",
      ru: "Одни из первых форм подоходного налога существовали еще в Древнем Египте."
    },
    fakeFact: {
      en: "Paper money was first invented in Renaissance Europe.",
      ru: "Бумажные деньги впервые появились в Европе в эпоху Возрождения."
    }
  },
  {
    id: "ff-024",
    category: { en: "Cinema", ru: "Кино" },
    realFact: {
      en: "Psycho was the first U.S. film to show a flushing toilet.",
      ru: "Фильм \"Психо\" стал первым фильмом в США, где показали смывающийся туалет."
    },
    fakeFact: {
      en: "The first feature-length film ever made was a 1925 comedy.",
      ru: "Первым полнометражным фильмом в истории считается комедия 1925 года."
    }
  },
  {
    id: "ff-025",
    category: { en: "Inventions", ru: "Изобретения" },
    realFact: {
      en: "Bubble wrap was originally invented as textured wallpaper.",
      ru: "Пузырчатую пленку изначально пытались продавать как фактурные обои."
    },
    fakeFact: {
      en: "The microwave oven was invented to melt chocolate in factories.",
      ru: "Микроволновку изобрели специально для растапливания шоколада на фабриках."
    }
  }
];

const CURATED_REVIEWED_AT = "2026-02-16";

const CURATED_PAIR_METADATA: Record<string, PairMetadata> = {
  "ff-001": {
    source: {
      name: "Wikipedia: Octopus",
      url: "https://en.wikipedia.org/wiki/Octopus"
    },
    tags: ["animals", "biology", "ocean"]
  },
  "ff-002": {
    source: {
      name: "Wikipedia: Anglo-Zanzibar War",
      url: "https://en.wikipedia.org/wiki/Anglo-Zanzibar_War"
    },
    tags: ["history", "war"]
  },
  "ff-003": {
    source: {
      name: "NASA Venus Facts",
      url: "https://science.nasa.gov/venus/facts/"
    },
    tags: ["space", "planets"]
  },
  "ff-004": {
    source: {
      name: "National Geographic: Wombat cube poop",
      url: "https://www.nationalgeographic.com/science/article/how-do-wombats-make-cube-shaped-poop"
    },
    tags: ["animals", "nature"]
  },
  "ff-005": {
    source: {
      name: "Smithsonian: Why honey does not spoil",
      url: "https://www.smithsonianmag.com/smart-news/honey-doesnt-expire-why-180960106/"
    },
    tags: ["food", "chemistry"]
  },
  "ff-006": {
    source: {
      name: "US EPA: Natural Radioactivity in Food",
      url: "https://www.epa.gov/radtown/natural-radioactivity-food"
    },
    tags: ["science", "food"]
  },
  "ff-007": {
    source: {
      name: "World Atlas: Countries with most lakes",
      url: "https://www.worldatlas.com/articles/which-country-has-the-most-lakes-in-the-world.html"
    },
    tags: ["geography", "nature"]
  },
  "ff-008": {
    source: {
      name: "NCBI Bookshelf: Fingerprint development",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK470476/"
    },
    tags: ["human-body", "biology"]
  },
  "ff-009": {
    source: {
      name: "National Geographic: First computer bug",
      url: "https://education.nationalgeographic.org/resource/worlds-first-computer-bug/"
    },
    tags: ["technology", "history"]
  },
  "ff-010": {
    source: {
      name: "Britannica: Alphabet",
      url: "https://www.britannica.com/topic/alphabet"
    },
    tags: ["language", "etymology"]
  },
  "ff-011": {
    source: {
      name: "NOAA: How much ocean have we explored?",
      url: "https://oceanservice.noaa.gov/facts/exploration.html"
    },
    tags: ["ocean", "science"]
  },
  "ff-012": {
    source: {
      name: "NOAA JetStream: Lightning facts",
      url: "https://www.noaa.gov/jetstream/lightning/facts"
    },
    tags: ["weather", "physics"]
  },
  "ff-013": {
    source: {
      name: "Britannica: Mona Lisa",
      url: "https://www.britannica.com/topic/Mona-Lisa-painting-by-Leonardo-da-Vinci"
    },
    tags: ["art", "painting"]
  },
  "ff-014": {
    source: {
      name: "USGA: Why golf balls have dimples",
      url: "https://www.usga.org/content/usga/home-page/tee-times/features/2018/03/why-do-golf-balls-have-dimples-.html"
    },
    tags: ["sports", "physics"]
  },
  "ff-015": {
    source: {
      name: "Guinness World Records: First speeding ticket",
      url: "https://www.guinnessworldrecords.com/world-records/first-speeding-ticket"
    },
    tags: ["transport", "history"]
  },
  "ff-016": {
    source: {
      name: "History.com: Typewriter history",
      url: "https://www.history.com/news/10-things-you-may-not-know-about-the-typewriter"
    },
    tags: ["books", "technology", "history"]
  },
  "ff-017": {
    source: {
      name: "Britannica: Wolfgang Amadeus Mozart",
      url: "https://www.britannica.com/biography/Wolfgang-Amadeus-Mozart"
    },
    tags: ["music", "history"]
  },
  "ff-018": {
    source: {
      name: "Britannica: Zero",
      url: "https://www.britannica.com/science/zero-mathematics"
    },
    tags: ["math", "history"]
  },
  "ff-019": {
    source: {
      name: "NASA: The Great Wall from space",
      url: "https://www.nasa.gov/history/20-years-ago-space-station-astronauts-share-what-they-see-from-space/"
    },
    tags: ["architecture", "space", "myth"]
  },
  "ff-020": {
    source: {
      name: "Britannica: Aspirin",
      url: "https://www.britannica.com/science/aspirin"
    },
    tags: ["medicine", "chemistry"]
  },
  "ff-021": {
    source: {
      name: "BBC: Why Japan grows square watermelons",
      url: "https://www.bbc.com/news/world-asia-35548757"
    },
    tags: ["culture", "food"]
  },
  "ff-022": {
    source: {
      name: "National Geographic: Turtles breathe through butt",
      url: "https://www.nationalgeographic.com/animals/article/turtles-breathe-from-butt"
    },
    tags: ["biology", "animals"]
  },
  "ff-023": {
    source: {
      name: "World History Encyclopedia: Taxation",
      url: "https://www.worldhistory.org/Taxation/"
    },
    tags: ["economics", "history"]
  },
  "ff-024": {
    source: {
      name: "Smithsonian: Facts about Psycho",
      url: "https://www.smithsonianmag.com/smart-news/13-things-you-didnt-know-about-psycho-180972142/"
    },
    tags: ["cinema", "history"]
  },
  "ff-025": {
    source: {
      name: "Smithsonian: History of Bubble Wrap",
      url: "https://www.smithsonianmag.com/innovation/fascinating-history-bubble-wrap-180979596/"
    },
    tags: ["inventions", "history"]
  }
};

const UNSAFE_CONTENT_PATTERN =
  /\b(sex|sexual|penis|vagina|orgasm|porn|genitals|fetish|explicit|orgy|rape|suicide|self-harm|gore|kill yourself|kill|killed|murder|murdered|bomb|gun|hitler|terror|terroris(?:m|t)|nazi|racis(?:m|t)|extremis(?:m|t))\b/i;
const UNSAFE_CONTENT_PATTERN_RU =
  /(секс|сексуал|пенис|вагин|оргазм|порно|генитал|фетиш|изнасил|суицид|самоубийств|самоповрежд|убийств|убил|бомб|оруж|гитлер|террор|наци|расист|экстремист)/i;
const AWKWARD_PUNCTUATION_PATTERN = /(,\.)|(\.{2,})|(\s{2,})|(\(\s*\))/;
const UNWANTED_IMPORT_PREFIX_PATTERN =
  /^(A verified fact states that|Historical sources report that|Reliable references show that)\b/i;
const BIBLIOGRAPHIC_ID_PATTERN = /-book-author-/i;
const EXTRACT_NOISE_PATTERN_EN =
  /(course of theoretical physics|there is a record in the bristol calendar|despite what you may have seen in bad sci-fi films|was written by)/i;
const EXTRACT_NOISE_PATTERN_RU =
  /(курс теоретической физики|в бристольском календаре|несмотря на то, что вы, возможно, видели в плохих научно-фантастических фильмах|написал\(а\))/i;
const EXTRACT_REFERENCE_PATTERN = /(\[[^\]]{1,40}\])|(…)/;

function normalizeFactText(text: string): string {
  return text
    .replace(UNWANTED_IMPORT_PREFIX_PATTERN, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])\1+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function hasCyrillic(text: string): boolean {
  return /[А-Яа-яЁё]/.test(text);
}

function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => normalizeTag(tag)).filter(Boolean))];
}

function hasNonEmptyBilingual(value: BilingualText): boolean {
  return value.en.trim().length > 0 && value.ru.trim().length > 0;
}

function passesEditorialTextFilter(text: string, language: Language): boolean {
  const trimmed = normalizeFactText(text);

  if (trimmed.length < (language === "ru" ? 10 : 12) || trimmed.length > (language === "ru" ? 260 : 220)) {
    return false;
  }

  if (UNSAFE_CONTENT_PATTERN.test(trimmed) || UNSAFE_CONTENT_PATTERN_RU.test(trimmed)) {
    return false;
  }

  if (AWKWARD_PUNCTUATION_PATTERN.test(trimmed)) {
    return false;
  }

  if (
    (language === "en" && EXTRACT_NOISE_PATTERN_EN.test(trimmed)) ||
    (language === "ru" && EXTRACT_NOISE_PATTERN_RU.test(trimmed))
  ) {
    return false;
  }

  if (EXTRACT_REFERENCE_PATTERN.test(trimmed)) {
    return false;
  }

  return true;
}

function metadataForCurated(pairId: string, kind: FactKind, category: BilingualText): FactCardMetadata {
  const pairMetadata = CURATED_PAIR_METADATA[pairId];
  const categoryTag = normalizeTag(category.en);
  const kindTag = kind === "fake" ? "myth" : "fact";
  const tags = uniqueTags([...(pairMetadata?.tags ?? []), categoryTag, kindTag]);

  return {
    qualityTier: "curated",
    sourceType: pairMetadata ? "wikipedia" : "manual_seed",
    verificationStatus: pairMetadata ? "verified" : "draft",
    familyFriendly: true,
    reviewedAt: CURATED_REVIEWED_AT,
    verifiedAt: pairMetadata ? CURATED_REVIEWED_AT : undefined,
    source: pairMetadata?.source,
    tags,
    notes: pairMetadata?.notes
  };
}

function sourceTypeForImported(id: string): FactCardMetadata["sourceType"] {
  if (id.startsWith("wd-")) {
    return "wikidata";
  }

  if (id.startsWith("opentdb-") || id.startsWith("opentriviaqa-") || id.startsWith("drive_xlsx-")) {
    return "reference_site";
  }

  if (id.startsWith("epub-")) {
    return "book_extract";
  }

  return "manual_seed";
}

function sourceForImported(id: string): FactSourceReference {
  if (id.startsWith("wd-")) {
    return {
      name: "Wikidata",
      url: "https://www.wikidata.org/"
    };
  }

  if (id.startsWith("epub-gi-")) {
    return {
      name: "The Book of General Ignorance",
      url: "https://en.wikipedia.org/wiki/The_Book_of_General_Ignorance"
    };
  }

  if (id.startsWith("epub-wpbt-")) {
    return {
      name: "Why People Believe Weird Things",
      url: "https://en.wikipedia.org/wiki/Why_People_Believe_Weird_Things"
    };
  }

  if (id.startsWith("epub-sgu-")) {
    return {
      name: "The Skeptics' Guide to the Universe",
      url: "https://en.wikipedia.org/wiki/The_Skeptics%27_Guide_to_the_Universe"
    };
  }

  if (id.startsWith("epub-dfdw-")) {
    return {
      name: "Do Fish Drink Water?",
      url: "https://www.goodreads.com/book/show/16067568-do-fish-drink-water"
    };
  }

  if (id.startsWith("epub-")) {
    return {
      name: "Curated EPUB Extract",
      url: "https://github.com/ogostos/game"
    };
  }

  if (id.startsWith("opentdb-")) {
    return {
      name: "Open Trivia Database",
      url: "https://opentdb.com/"
    };
  }

  if (id.startsWith("opentriviaqa-")) {
    return {
      name: "OpenTriviaQA",
      url: "https://github.com/uberspot/OpenTriviaQA"
    };
  }

  if (id.startsWith("drive_xlsx-")) {
    return {
      name: "Google Drive Trivia Workbook",
      url: "https://drive.google.com/file/d/0Bzs-xvR-5hQ3SGdxNXpWVHFNWG8/view"
    };
  }

  return {
    name: "Curated Source",
    url: "https://github.com/ogostos/game"
  };
}

function metadataForImported(id: string, kind: FactKind, category: BilingualText): FactCardMetadata {
  const kindTag = kind === "fake" ? "myth" : "fact";
  const categoryTag = normalizeTag(category.en);
  const sourceType = sourceTypeForImported(id);

  return {
    qualityTier: "curated",
    sourceType,
    verificationStatus: "verified",
    familyFriendly: true,
    reviewedAt: CURATED_REVIEWED_AT,
    verifiedAt: CURATED_REVIEWED_AT,
    source: sourceForImported(id),
    tags: uniqueTags([categoryTag, kindTag, "family-friendly", sourceType]),
    notes: "Included from curated family-friendly pipeline."
  };
}

function toImportedFacts(value: unknown, kind: FactKind): FactSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: FactSource[] = [];

  for (const row of value) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const candidate = row as Partial<CuratedFactSource>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const category = candidate.category;
    const text = candidate.text;
    const correction = candidate.correction;

    if (
      !id ||
      !category ||
      !text ||
      typeof category.en !== "string" ||
      typeof category.ru !== "string" ||
      typeof text.en !== "string" ||
      typeof text.ru !== "string"
    ) {
      continue;
    }

    if (
      kind === "fake" &&
      (!correction ||
        typeof correction.en !== "string" ||
        typeof correction.ru !== "string" ||
        !correction.en.trim() ||
        !correction.ru.trim())
    ) {
      continue;
    }

    output.push({
      id,
      category: {
        en: category.en,
        ru: category.ru
      },
      text: {
        en: text.en,
        ru: text.ru
      },
      correction:
        kind === "fake" && correction
          ? {
              en: correction.en,
              ru: correction.ru
            }
          : undefined,
      kind,
      metadata: metadataForImported(id, kind, category)
    });
  }

  return output;
}

function isPublishableFactSource(fact: FactSource): boolean {
  if (!fact.id.trim()) {
    return false;
  }

  if (BIBLIOGRAPHIC_ID_PATTERN.test(fact.id)) {
    return false;
  }

  if (!hasNonEmptyBilingual(fact.category) || !hasNonEmptyBilingual(fact.text)) {
    return false;
  }

  if (!hasCyrillic(fact.category.ru) || !hasCyrillic(fact.text.ru)) {
    return false;
  }

  if (normalizeFactText(fact.text.en).toLowerCase() === normalizeFactText(fact.text.ru).toLowerCase()) {
    return false;
  }

  if (!fact.metadata.familyFriendly || fact.metadata.verificationStatus !== "verified") {
    return false;
  }

  if (!passesEditorialTextFilter(fact.text.en, "en") || !passesEditorialTextFilter(fact.text.ru, "ru")) {
    return false;
  }

  if (fact.kind === "fake") {
    if (!fact.correction || !hasNonEmptyBilingual(fact.correction)) {
      return false;
    }

    if (!hasCyrillic(fact.correction.ru)) {
      return false;
    }

    if (
      !passesEditorialTextFilter(fact.correction.en, "en") ||
      !passesEditorialTextFilter(fact.correction.ru, "ru")
    ) {
      return false;
    }
  }

  return true;
}

function localizeText(text: BilingualText, language: Language): string {
  return language === "ru" ? text.ru : text.en;
}

function toFactCard(fact: FactSource, language: Language): FactCard {
  return {
    id: fact.id,
    category: localizeText(fact.category, language),
    text: localizeText(fact.text, language),
    kind: fact.kind,
    correction: fact.correction ? localizeText(fact.correction, language) : null,
    metadata: fact.metadata
  } as FactCard;
}

function dedupeById(facts: FactSource[]): FactSource[] {
  const seen = new Set<string>();

  return facts.filter((fact) => {
    if (seen.has(fact.id)) {
      return false;
    }

    seen.add(fact.id);
    return true;
  });
}

const curatedRealFacts: FactSource[] = FACT_OR_FAKE_SOURCE.map((fact) => ({
  id: `${fact.id}-real`,
  category: fact.category,
  text: fact.realFact,
  kind: "real" as FactKind,
  metadata: metadataForCurated(fact.id, "real", fact.category)
})).filter(isPublishableFactSource);

const importedFacts = curatedFactsSource as CuratedFactsPayload;
const extractedEpubFakes = epubFakesSource as CuratedFactsPayload;
const importedRealFacts = toImportedFacts(importedFacts.realFacts, "real").filter(isPublishableFactSource);
const extractedEpubFakeFacts = toImportedFacts(extractedEpubFakes.fakeFacts, "fake").filter(
  isPublishableFactSource
);

const REAL_FACT_SOURCE = dedupeById([...curatedRealFacts, ...importedRealFacts]);
const FAKE_FACT_SOURCE = dedupeById([...extractedEpubFakeFacts]);

export const FACT_OR_FAKE_REAL_FACT_COUNT = REAL_FACT_SOURCE.length;
export const FACT_OR_FAKE_FAKE_FACT_COUNT = FAKE_FACT_SOURCE.length;
export const FACT_OR_FAKE_FACT_COUNT = FACT_OR_FAKE_REAL_FACT_COUNT;

export function getFactOrFakeDeck(language: Language): FactDeck {
  return {
    realFacts: REAL_FACT_SOURCE.map((fact) => toFactCard(fact, language)),
    fakeFacts: FAKE_FACT_SOURCE.map((fact) => toFactCard(fact, language))
  };
}
