import { createAppServer } from "../server.js";

const app = createAppServer();
const server = await new Promise((resolve) => {
  const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
});

const baseUrl = `http://127.0.0.1:${server.address().port}`;

async function waitForHealth() {
  const response = await fetch(`${baseUrl}/api/health`);
  if (!response.ok) throw new Error("Server did not become healthy");
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

try {
  await waitForHealth();
  const session = await post("/api/session", { role: "student" });
  const chat = await post("/api/chat", {
    sessionId: session.sessionId,
    message: "Мне 16 лет. В детстве любил конструкторы, в школе нравилась биология и химия. Люблю рисовать, спокойно разбираться в деталях, не люблю публичные выступления. Хочу гибкий график."
  });
  const recommendations = await post("/api/recommendations", { sessionId: session.sessionId });
  const purchase = await post("/api/purchase", {
    sessionId: session.sessionId,
    professionId: recommendations.recommendations[0].id
  });

  console.log(JSON.stringify({
    ok: true,
    completeness: chat.profile.completeness,
    top: recommendations.recommendations[0].title,
    paid: purchase.paid,
    amount: purchase.amount
  }, null, 2));
} finally {
  server.close();
}
