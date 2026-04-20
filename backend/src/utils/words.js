const DEFAULT_WORDS = {
  animals: ["elephant", "giraffe", "dolphin", "kangaroo", "penguin", "rabbit", "tiger", "zebra"],
  objects: ["backpack", "umbrella", "keyboard", "pencil", "bicycle", "camera", "clock", "window"],
  food: ["hamburger", "banana", "pizza", "sandwich", "pancake", "carrot", "cupcake", "noodles"],
  nature: ["mountain", "rainbow", "volcano", "waterfall", "forest", "desert", "island", "cloud"],
  actions: ["running", "sleeping", "dancing", "cooking", "jumping", "reading", "swimming", "laughing"]
};

export const CATEGORIES = Object.keys(DEFAULT_WORDS);

export function normalizeWord(word) {
  return String(word || "").trim().toLowerCase();
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getWordPool(category, customWords = [], customWordsOnly = false) {
  const defaults = category && DEFAULT_WORDS[category] ? DEFAULT_WORDS[category] : Object.values(DEFAULT_WORDS).flat();
  const safeCustomWords = customWords.map((w) => String(w).trim()).filter((w) => w.length >= 2);
  if (customWordsOnly && safeCustomWords.length) {
    return Array.from(new Set(safeCustomWords));
  }
  return Array.from(new Set([...defaults, ...safeCustomWords]));
}

export function getWordChoices({ category, count, customWords, customWordsOnly }) {
  const pool = shuffle(getWordPool(category, customWords, customWordsOnly));
  return pool.slice(0, Math.max(1, Math.min(5, count || 3)));
}

export function maskWord(word, revealedIndexes = new Set()) {
  return word
    .split("")
    .map((char, index) => {
      if (char === " ") {
        return " ";
      }
      return revealedIndexes.has(index) ? char : "_";
    })
    .join(" ");
}

export function initialRevealIndexes(word, mode) {
  const revealed = new Set();
  if (!word || mode !== "combination") {
    return revealed;
  }

  const letterIndexes = [];
  for (let i = 0; i < word.length; i += 1) {
    if (word[i] !== " ") {
      letterIndexes.push(i);
    }
  }

  const revealCount = Math.max(1, Math.floor(letterIndexes.length * 0.2));
  const shuffled = shuffle(letterIndexes);
  for (let i = 0; i < revealCount; i += 1) {
    revealed.add(shuffled[i]);
  }
  return revealed;
}

export function maskWordByMode(word, revealedIndexes = new Set(), mode = "normal") {
  if (!word) {
    return null;
  }
  if (mode === "hidden") {
    return "? ? ?";
  }
  return maskWord(word, revealedIndexes);
}

export function nextHintIndex(word, revealedIndexes) {
  const hiddenIndexes = [];
  for (let i = 0; i < word.length; i += 1) {
    if (word[i] !== " " && !revealedIndexes.has(i)) {
      hiddenIndexes.push(i);
    }
  }
  if (!hiddenIndexes.length) {
    return null;
  }
  const randomPos = Math.floor(Math.random() * hiddenIndexes.length);
  return hiddenIndexes[randomPos];
}
