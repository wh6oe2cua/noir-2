import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { PREMADE_QUESTIONS } from "./src/questions";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Map localized theme parameter to actual English keys in PREMADE_QUESTIONS
const THEME_MAP_KEYS: Record<string, string> = {
  "history": "history",
  "science": "science",
  "it_tech": "it_tech",
  "trivia": "trivia",
  "fraud_prevention": "fraud_prevention",
  "logic_flaw": "logic_flaw",
};

// API Endpoint to get pre-made questions
app.post("/api/generate-question", async (req, res) => {
  const { theme, difficulty, seenIds } = req.body;
  const targetTheme = theme || "random";
  const targetDifficulty = difficulty || "normal";
  const excludedIds = Array.isArray(seenIds) ? seenIds : [];

  let selectedThemeKey = targetTheme;
  
  // If random, select a random theme from the keys
  if (targetTheme === "random" || !THEME_MAP_KEYS[targetTheme]) {
    const keys = Object.keys(PREMADE_QUESTIONS);
    selectedThemeKey = keys[Math.floor(Math.random() * keys.length)];
  } else {
    selectedThemeKey = THEME_MAP_KEYS[targetTheme];
  }

  const questionList = PREMADE_QUESTIONS[selectedThemeKey] || [];
  
  // Filter by difficulty and exclude already seen questions
  let filteredList = questionList.filter(
    (q) => q.difficulty === targetDifficulty && !excludedIds.includes(q.id)
  );

  // If no questions match after filtering, try ignoring difficulty but excluding seen
  if (filteredList.length === 0) {
    filteredList = questionList.filter((q) => !excludedIds.includes(q.id));
  }

  // If still empty (all questions in category are seen), fallback to allowing seen questions
  if (filteredList.length === 0) {
    filteredList = questionList.filter((q) => q.difficulty === targetDifficulty);
  }

  // Final fallback to the full list in the category
  if (filteredList.length === 0) {
    filteredList = questionList;
  }

  // If the list is empty (should not happen), fallback to all questions
  if (filteredList.length === 0) {
    const allQuestions = Object.values(PREMADE_QUESTIONS).flat();
    filteredList = allQuestions;
  }

  // Pick a random question from the filtered list
  const randomQuestion = filteredList[Math.floor(Math.random() * filteredList.length)];

  // Return the question with a unique run ID to avoid caching issues in client state
  const responseData = {
    ...randomQuestion,
    id: `${randomQuestion.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    baseId: randomQuestion.id, // Keep the real ID separate for seenIds tracking
  };

  return res.json(responseData);
});

// Vite & Static file hosting configuration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
