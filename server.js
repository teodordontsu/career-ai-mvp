import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const PROFESSIONS_FILE = path.join(DATA_DIR, "professions.json");

const requiredCriteria = [
  { key: "childhood", label: "Детство и поведение", question: "Каким вы были в детстве: спокойным, активным, любопытным, общительным, самостоятельным? Что любили делать без просьб взрослых?" },
  { key: "school", label: "Учеба и предметы", question: "Какие предметы давались легче, а какие вызывали сопротивление? Что в школе нравилось делать больше всего?" },
  { key: "interests", label: "Интересы и хобби", question: "Какие хобби, темы, занятия или видео вы выбираете сами, когда есть свободное время?" },
  { key: "social", label: "Общение", question: "Вам комфортнее работать одному, один на один или в команде? Публичные выступления заряжают или утомляют?" },
  { key: "workStyle", label: "Стиль работы", question: "Что вам ближе: исследовать, придумывать, помогать людям, собирать руками, анализировать данные или организовывать процесс?" },
  { key: "lifestyle", label: "Образ жизни", question: "Какой график и формат работы вы бы хотели: стабильный, гибкий, удаленный, с людьми, без людей, с поездками или без?" },
  { key: "constraints", label: "Ограничения", question: "Есть ли ограничения по здоровью, городу, бюджету, сроку обучения или уровню дохода на старте?" }
];

const keywordMap = {
  biology: ["биолог", "медицин", "генет", "анатом", "хими", "лаборатор", "природ"],
  analytics: ["анализ", "данн", "закономер", "логик", "исслед", "разбират", "причин"],
  details: ["детал", "вниматель", "аккурат", "усид", "копаться", "точн"],
  calm: ["спокой", "тих", "без стрес", "не люблю шум", "один"],
  visual: ["рис", "дизайн", "визуал", "красив", "оформ", "иллюстр"],
  creativity: ["придум", "твор", "созда", "креатив"],
  computer: ["компьют", "код", "python", "айти", "it", "программ"],
  people: ["люд", "помог", "общ", "команд", "клиент"],
  communication: ["говор", "объясн", "выступ", "переговор", "общ"],
  explain: ["объясн", "учить", "настав", "репет"],
  hands: ["руками", "собирать", "конструкт", "механ", "мастер"],
  routine: ["рутин", "повтор", "регламент", "стабиль"],
  fast: ["быстро", "динами", "событ", "переключ"]
};

const criterionKeywords = {
  childhood: ["детств", "малень", "ребен", "любил", "любила", "конструкт", "сам"],
  school: ["школ", "класс", "предмет", "учеб", "математ", "биолог", "русск", "истор", "хими"],
  interests: ["хобби", "интерес", "люблю", "нрав", "рис", "спорт", "игр", "чита", "музык"],
  social: ["общ", "люд", "команд", "один", "публич", "выступ", "друз"],
  workStyle: ["анализ", "придум", "созда", "помог", "организ", "исслед", "руками", "детал"],
  lifestyle: ["график", "удален", "офис", "доход", "стабил", "гибк", "поезд", "работ"],
  constraints: ["огранич", "здоров", "город", "бюджет", "время", "срок", "деньг", "экзам"]
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function saveSessions(sessions) {
  await writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf8");
}

function normalize(text = "") {
  return text.toLowerCase().replaceAll("ё", "е");
}

function inferTraits(messages) {
  const text = normalize(messages.map((item) => item.content).join(" "));
  const traits = new Set();
  for (const [trait, words] of Object.entries(keywordMap)) {
    if (words.some((word) => text.includes(word))) traits.add(trait);
  }
  if (text.includes("не люблю выступ") || text.includes("не люблю публич")) {
    traits.add("low_people");
    traits.add("public_speaking");
  }
  if (text.includes("не люблю общ") || text.includes("мало общ")) traits.add("low_people");
  if (!traits.size) traits.add("curiosity");
  return [...traits];
}

function analyzeCriteria(messages) {
  const text = normalize(messages.map((item) => item.content).join(" "));
  return requiredCriteria.map((criterion) => {
    const hits = criterionKeywords[criterion.key].filter((word) => text.includes(word));
    return {
      ...criterion,
      done: hits.length > 0,
      confidence: Math.min(1, hits.length / 2)
    };
  });
}

function buildProfile(session) {
  const userMessages = session.messages.filter((message) => message.role === "user");
  const criteria = analyzeCriteria(userMessages);
  const traits = inferTraits(userMessages);
  const completeness = Math.round((criteria.filter((item) => item.done).length / criteria.length) * 100);
  return {
    role: session.role,
    traits,
    criteria,
    completeness,
    transcript: userMessages.map((item) => item.content).join("\n")
  };
}

function makeAssistantReply(profile) {
  const missing = profile.criteria.filter((item) => !item.done);
  if (!missing.length || profile.completeness >= 86) {
    return {
      done: true,
      content: "Карточка профиля собрана. Я могу запускать подбор профессий по интересам, психотипу, ограничениям, графику, доходам и рынку."
    };
  }

  const next = missing.slice(0, 2);
  return {
    done: false,
    content: `Хорошо, я уже собрал(а) часть профиля. Осталось уточнить: ${next.map((item) => item.label.toLowerCase()).join(" и ")}.\n\n${next.map((item) => `• ${item.question}`).join("\n")}`
  };
}

function scoreProfession(profession, profile) {
  const traits = new Set(profile.traits);
  let score = 45;
  const matched = [];
  for (const trait of profession.traits) {
    if (traits.has(trait)) {
      score += 9;
      matched.push(trait);
    }
  }
  for (const avoid of profession.avoid || []) {
    if (traits.has(avoid)) score -= 14;
  }
  score += Math.min(10, Math.round(profile.completeness / 12));
  return {
    score: Math.max(12, Math.min(98, score)),
    matched
  };
}

async function callOpenAIForReply(profile, latestMessage) {
  if (!OPENAI_API_KEY) return null;

  const prompt = [
    "Ты внутренний AI-профориентолог мобильного приложения.",
    "Твоя задача: собрать профиль человека и задать 1-2 уточняющих вопроса, если информации не хватает.",
    "Не выдавай профессию, пока профиль не заполнен.",
    "Отвечай по-русски, кратко и заботливо.",
    `Текущая полнота профиля: ${profile.completeness}%.`,
    `Критерии: ${profile.criteria.map((item) => `${item.label}: ${item.done ? "готово" : "нет"}`).join("; ")}.`,
    `Последнее сообщение пользователя: ${latestMessage}`
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      store: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join("\n") || null;
}

async function handleSession(req, res) {
  const { role = "student" } = await parseBody(req);
  const sessions = await readJson(SESSIONS_FILE, {});
  const id = crypto.randomUUID();
  sessions[id] = {
    id,
    role,
    createdAt: new Date().toISOString(),
    messages: [],
    purchases: []
  };
  await saveSessions(sessions);
  sendJson(res, 200, { sessionId: id });
}

async function handleChat(req, res) {
  const { sessionId, message } = await parseBody(req);
  if (!sessionId || !message) return sendJson(res, 400, { error: "sessionId and message are required" });

  const sessions = await readJson(SESSIONS_FILE, {});
  const session = sessions[sessionId];
  if (!session) return sendJson(res, 404, { error: "session not found" });

  session.messages.push({ role: "user", content: String(message).trim(), createdAt: new Date().toISOString() });
  const profile = buildProfile(session);
  let aiContent;
  let aiMode = "mock";

  try {
    aiContent = await callOpenAIForReply(profile, message);
    if (aiContent) aiMode = "openai";
  } catch (error) {
    aiContent = null;
    session.lastOpenAIError = error.message;
  }

  const fallback = makeAssistantReply(profile);
  const assistantMessage = {
    role: "assistant",
    content: aiContent || fallback.content,
    createdAt: new Date().toISOString()
  };
  session.messages.push(assistantMessage);
  session.profile = profile;
  sessions[sessionId] = session;
  await saveSessions(sessions);

  sendJson(res, 200, {
    reply: assistantMessage.content,
    profile,
    complete: fallback.done,
    mode: aiMode,
    openAIError: session.lastOpenAIError || null
  });
}

async function handleRecommendations(req, res) {
  const { sessionId } = await parseBody(req);
  const sessions = await readJson(SESSIONS_FILE, {});
  const session = sessions[sessionId];
  if (!session) return sendJson(res, 404, { error: "session not found" });

  const profile = session.profile || buildProfile(session);
  const professions = await readJson(PROFESSIONS_FILE, []);
  const recommendations = professions
    .map((profession) => ({ ...profession, ...scoreProfession(profession, profile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((profession) => ({
      id: profession.id,
      title: profession.title,
      summary: profession.summary,
      score: profession.score,
      income: profession.income,
      schedule: profession.schedule,
      demand: profession.demand
    }));

  session.recommendations = recommendations;
  session.profile = profile;
  sessions[sessionId] = session;
  await saveSessions(sessions);

  sendJson(res, 200, { profile, recommendations });
}

async function handlePurchase(req, res) {
  const { sessionId, professionId } = await parseBody(req);
  const sessions = await readJson(SESSIONS_FILE, {});
  const session = sessions[sessionId];
  if (!session) return sendJson(res, 404, { error: "session not found" });

  const professions = await readJson(PROFESSIONS_FILE, []);
  const profession = professions.find((item) => item.id === professionId);
  if (!profession) return sendJson(res, 404, { error: "profession not found" });

  session.purchases ||= [];
  if (!session.purchases.includes(professionId)) session.purchases.push(professionId);
  sessions[sessionId] = session;
  await saveSessions(sessions);

  sendJson(res, 200, {
    paid: true,
    amount: 500,
    profession
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };
  const body = await readFile(filePath);
  res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
  res.end(body);
}

export function createAppServer() {
  return createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/session") return await handleSession(req, res);
    if (req.method === "POST" && req.url === "/api/chat") return await handleChat(req, res);
    if (req.method === "POST" && req.url === "/api/recommendations") return await handleRecommendations(req, res);
    if (req.method === "POST" && req.url === "/api/purchase") return await handlePurchase(req, res);
    if (req.method === "GET" && req.url === "/api/health") {
      return sendJson(res, 200, { ok: true, openai: Boolean(OPENAI_API_KEY), model: MODEL });
    }
    return await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const server = createAppServer();
  server.listen(PORT, () => {
    console.log(`Career AI MVP running on http://localhost:${PORT}`);
    console.log(OPENAI_API_KEY ? `OpenAI mode enabled with model ${MODEL}` : "Mock AI mode enabled. Set OPENAI_API_KEY to use OpenAI.");
  });
}
