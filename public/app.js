const state = {
  role: "student",
  sessionId: localStorage.getItem("careerAiSessionId") || null,
  recommendations: []
};

const views = {
  home: document.querySelector("#homeView"),
  chat: document.querySelector("#chatView"),
  results: document.querySelector("#resultsView"),
  detail: document.querySelector("#detailView")
};

const roleList = document.querySelector("#roleList");
const startBtn = document.querySelector("#startBtn");
const resetBtn = document.querySelector("#resetBtn");
const chatForm = document.querySelector("#chatForm");
const chatBody = document.querySelector("#chatBody");
const messageInput = document.querySelector("#messageInput");
const criteriaList = document.querySelector("#criteriaList");
const progressPill = document.querySelector("#progressPill");
const recommendBtn = document.querySelector("#recommendBtn");
const professionList = document.querySelector("#professionList");
const thinkingBox = document.querySelector("#thinkingBox");
const paidCard = document.querySelector("#paidCard");
const backToResults = document.querySelector("#backToResults");
const voiceBtn = document.querySelector("#voiceBtn");
const aiMode = document.querySelector("#aiMode");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA install support is optional; the app should still work without it.
    });
  });
}

function showView(name) {
  Object.values(views).forEach((view) => view.classList.remove("active"));
  views[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function api(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Ошибка запроса");
  return data;
}

function addMessage(role, content) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = content;
  chatBody.appendChild(node);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function renderCriteria(profile) {
  if (!profile?.criteria) return;
  progressPill.textContent = `${profile.completeness}%`;
  criteriaList.innerHTML = profile.criteria.map((item) => `
    <div class="criterion">
      <strong>${item.label}</strong>
      <span class="${item.done ? "done" : "wait"}">${item.done ? "готово" : "уточнить"}</span>
    </div>
  `).join("");
}

function setLoading(button, loading, text = "Загрузка...") {
  if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
  button.disabled = loading;
  button.textContent = loading ? text : button.dataset.defaultText;
}

roleList.addEventListener("click", (event) => {
  const card = event.target.closest(".role-card");
  if (!card) return;
  state.role = card.dataset.role;
  document.querySelectorAll(".role-card").forEach((item) => item.classList.remove("selected"));
  card.classList.add("selected");
});

startBtn.addEventListener("click", async () => {
  setLoading(startBtn, true);
  try {
    const data = await api("/api/session", { role: state.role });
    state.sessionId = data.sessionId;
    localStorage.setItem("careerAiSessionId", state.sessionId);
    showView("chat");
  } catch (error) {
    alert(error.message);
  } finally {
    setLoading(startBtn, false);
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  if (!state.sessionId) {
    const data = await api("/api/session", { role: state.role });
    state.sessionId = data.sessionId;
    localStorage.setItem("careerAiSessionId", state.sessionId);
  }

  addMessage("user", message);
  messageInput.value = "";
  addMessage("ai", "Думаю над ответом...");
  const pending = chatBody.lastElementChild;

  try {
    const data = await api("/api/chat", { sessionId: state.sessionId, message });
    pending.textContent = data.reply;
    aiMode.textContent = data.mode === "openai" ? "OpenAI API" : "mock-режим";
    renderCriteria(data.profile);
    if (data.profile.completeness >= 86 || data.complete) {
      recommendBtn.classList.remove("hidden");
    }
  } catch (error) {
    pending.textContent = `Ошибка: ${error.message}`;
  }
});

recommendBtn.addEventListener("click", async () => {
  showView("results");
  professionList.innerHTML = "";
  thinkingBox.classList.remove("hidden");
  setLoading(recommendBtn, true);

  try {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const data = await api("/api/recommendations", { sessionId: state.sessionId });
    state.recommendations = data.recommendations;
    thinkingBox.classList.add("hidden");
    renderRecommendations(data.recommendations);
  } catch (error) {
    professionList.innerHTML = `<div class="message ai">Ошибка: ${error.message}</div>`;
  } finally {
    setLoading(recommendBtn, false);
  }
});

function renderRecommendations(items) {
  professionList.innerHTML = items.map((item) => `
    <article class="profession">
      <div class="profession-head">
        <div class="score ${item.score < 78 ? "mid" : ""}">${item.score}%</div>
        <div>
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
        </div>
      </div>
      <div class="meta-row">
        <span class="chip">доход: ${item.income}</span>
        <span class="chip">график: ${item.schedule}</span>
        <span class="chip">спрос: ${item.demand}</span>
      </div>
      <button class="details-btn" type="button" data-profession="${item.id}">Подробнее за 500 ₽</button>
    </article>
  `).join("");
}

professionList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-profession]");
  if (!button) return;

  setLoading(button, true, "Открываем...");
  try {
    const data = await api("/api/purchase", {
      sessionId: state.sessionId,
      professionId: button.dataset.profession
    });
    renderPaidCard(data.profession);
    showView("detail");
  } catch (error) {
    alert(error.message);
  } finally {
    setLoading(button, false);
  }
});

function renderList(title, items) {
  return `
    <div class="detail-block">
      <h2>${title}</h2>
      <ul class="detail-list">
        ${items.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderPaidCard(profession) {
  paidCard.innerHTML = `
    <div class="paid-card">
      <h2>${profession.title}</h2>
      <p>${profession.summary}</p>
      <div class="price-row">
        <span class="price">500 ₽</span>
        <span>демо-оплата выполнена</span>
      </div>
    </div>
    <div class="detail-block">
      <h2>Ключевые параметры</h2>
      <p><strong>Доход:</strong> ${profession.income}</p>
      <p><strong>График:</strong> ${profession.schedule}</p>
      <p><strong>Спрос:</strong> ${profession.demand}</p>
    </div>
    ${renderList("Ежедневные задачи", profession.dailyTasks)}
    ${renderList("Рост", profession.growth)}
    ${renderList("Что учить", profession.education)}
    ${renderList("Риски", profession.risks)}
  `;
}

backToResults.addEventListener("click", () => showView("results"));

resetBtn.addEventListener("click", () => {
  localStorage.removeItem("careerAiSessionId");
  location.reload();
});

voiceBtn.addEventListener("click", () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Голосовой ввод не поддерживается этим браузером. Можно ввести ответ текстом.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "ru-RU";
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    messageInput.value = event.results[0][0].transcript;
  };
  recognition.start();
});
