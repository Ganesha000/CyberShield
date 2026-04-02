const state = {
  token: localStorage.getItem("cybershield-token") || "",
  user: JSON.parse(localStorage.getItem("cybershield-user") || "null"),
  authMode: "login",
  charts: { vulnerability: null, strength: null },
  latestReport: null
};

const sections = Array.from(document.querySelectorAll(".panel"));
const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const authTabs = Array.from(document.querySelectorAll(".auth-tab"));
const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");
const nameRow = document.getElementById("nameRow");
const scanMessage = document.getElementById("scanMessage");
const checklistForm = document.getElementById("checklistForm");
const profileChip = document.getElementById("profileChip");
const logoutBtn = document.getElementById("logoutBtn");
const themeToggle = document.getElementById("themeToggle");

function activateSection(targetId) {
  sections.forEach((section) => section.classList.toggle("active-view", section.id === targetId));
  navLinks.forEach((button) => button.classList.toggle("active", button.dataset.section === targetId));
}

function setAuthMode(mode) {
  state.authMode = mode;
  authTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.authMode === mode));
  nameRow.classList.toggle("hidden", mode !== "signup");
  authMessage.textContent = mode === "signup" ? "Create your account to save scans and reports." : "";
}

function updateSessionUi() {
  const loggedIn = Boolean(state.token && state.user);
  profileChip.textContent = loggedIn ? state.user.name.split(" ")[0] : "Guest";
  logoutBtn.classList.toggle("hidden", !loggedIn);
}

function persistSession(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem("cybershield-token", data.token);
  localStorage.setItem("cybershield-user", JSON.stringify(data.user));
  updateSessionUi();
}

function clearSession() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("cybershield-token");
  localStorage.removeItem("cybershield-user");
  updateSessionUi();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

function getChecklistAnswers() {
  return Object.fromEntries(new FormData(checklistForm).entries());
}

function calculateLocalDistribution(report) {
  return {
    labels: [
      "Multi-factor authentication",
      "Strong unique passwords",
      "Software update habits",
      "Public Wi-Fi exposure",
      "Phishing awareness"
    ],
    values: [
      ["always", "most"].includes(report.answers.mfa) ? 25 : 9,
      ["password-manager", "unique-passphrases"].includes(report.answers.passwords) ? 25 : 9,
      ["auto", "weekly"].includes(report.answers.updates) ? 20 : 7,
      ["rarely", "vpn"].includes(report.answers.publicWifi) ? 15 : 5,
      ["confident", "trained"].includes(report.answers.phishing) ? 15 : 5
    ]
  };
}

function renderList(containerId, items, emptyMessage) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  (items?.length ? items : [emptyMessage]).forEach((item) => {
    const node = document.createElement("div");
    node.className = "stack-item";
    node.textContent = item;
    container.appendChild(node);
  });
}

function renderSimulations(simulations) {
  const grid = document.getElementById("simulationGrid");
  grid.innerHTML = "";
  simulations.forEach((simulation) => {
    const card = document.createElement("article");
    card.className = `simulation-card severity-${simulation.severity}`;
    card.innerHTML = `<p class="eyebrow">${simulation.impact}</p><h4>${simulation.title}</h4><p>${simulation.detail}</p>`;
    grid.appendChild(card);
  });
}

function renderHistory(history) {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  if (!history.length) {
    list.innerHTML = '<div class="history-item"><span>No scans yet</span><span>Run your first analysis</span></div>';
    return;
  }
  history.forEach((scan) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `<div><strong>${scan.score}/100</strong><p>${new Date(scan.createdAt).toLocaleString()}</p></div><div class="risk-badge risk-${scan.riskLevel.toLowerCase()}">${scan.riskLevel}</div>`;
    list.appendChild(item);
  });
}

function renderCharts(report) {
  const distribution = calculateLocalDistribution(report);
  const textColor = getComputedStyle(document.body).getPropertyValue("--text").trim();
  const mutedColor = getComputedStyle(document.body).getPropertyValue("--muted").trim();

  if (state.charts.vulnerability) state.charts.vulnerability.destroy();
  if (state.charts.strength) state.charts.strength.destroy();

  state.charts.vulnerability = new Chart(document.getElementById("vulnerabilityChart"), {
    type: "radar",
    data: {
      labels: distribution.labels,
      datasets: [
        {
          label: "Protection Strength",
          data: distribution.values,
          backgroundColor: "rgba(34, 197, 94, 0.14)",
          borderColor: "#22c55e",
          pointBackgroundColor: "#86efac",
          pointBorderColor: "#ffffff"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor } } },
      scales: {
        r: {
          angleLines: { color: "rgba(255,255,255,0.08)" },
          grid: { color: "rgba(255,255,255,0.08)" },
          pointLabels: { color: mutedColor },
          ticks: { display: false, stepSize: 5, backdropColor: "transparent" }
        }
      }
    }
  });

  state.charts.strength = new Chart(document.getElementById("strengthChart"), {
    type: "line",
    data: {
      labels: distribution.labels,
      datasets: [
        {
          label: "Control Maturity",
          data: distribution.values,
          fill: true,
          borderWidth: 3,
          tension: 0.4,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.18)",
          pointRadius: 5,
          pointBackgroundColor: "#bfdbfe"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor } } },
      scales: {
        x: { ticks: { color: mutedColor }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: mutedColor }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true, max: 25 }
      }
    }
  });
}

function renderReport(report) {
  state.latestReport = report;
  activateSection("dashboard");

  const scoreValue = document.getElementById("scoreValue");
  const scoreStroke = document.getElementById("scoreStroke");
  const riskBadge = document.getElementById("riskBadge");
  const riskExplanation = document.getElementById("riskExplanation");
  const badgeTray = document.getElementById("badgeTray");

  scoreValue.textContent = report.score;
  const circumference = 302;
  scoreStroke.style.strokeDashoffset = circumference - (circumference * report.score) / 100;
  scoreStroke.style.stroke = report.riskLevel === "Low" ? "#22c55e" : report.riskLevel === "Medium" ? "#f59e0b" : "#ef4444";

  riskBadge.className = `risk-badge risk-${report.riskLevel.toLowerCase()}`;
  riskBadge.textContent = `${report.riskLevel} Risk`;
  riskExplanation.textContent = report.ai?.riskExplanation || "Your risk explanation will appear here after the scan.";

  badgeTray.innerHTML = "";
  (report.badges || []).forEach((badge) => {
    const chip = document.createElement("span");
    chip.className = "badge";
    chip.textContent = badge;
    badgeTray.appendChild(chip);
  });

  renderList("weakPoints", report.vulnerabilities, "No critical weak points detected.");
  renderList("recommendations", report.ai?.recommendations, "Recommendations will appear after analysis.");
  renderList("securityTips", report.ai?.securityTips, "Security tips will appear after analysis.");
  renderSimulations(report.simulations || []);
  renderCharts(report);
}

async function loadHistory() {
  if (!state.token) return;
  try {
    const history = await api("/api/history");
    renderHistory(history);
    if (!state.latestReport && history[0]) renderReport(history[0]);
  } catch (error) {
    renderHistory([]);
  }
}

function exportPdf() {
  if (!state.latestReport) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const report = state.latestReport;

  doc.setFontSize(20);
  doc.text("CyberShield Security Report", 20, 20);
  doc.setFontSize(11);
  doc.text("Premium AI-powered cybersecurity checklist for students", 20, 30);
  doc.text(`Score: ${report.score}/100`, 20, 42);
  doc.text(`Risk Level: ${report.riskLevel}`, 20, 50);

  let y = 64;
  doc.text("Weak Points:", 20, y);
  y += 8;
  (report.vulnerabilities || []).forEach((item) => {
    doc.text(`- ${item}`, 24, y);
    y += 8;
  });

  y += 4;
  doc.text("AI Recommendations:", 20, y);
  y += 8;
  (report.ai?.recommendations || []).forEach((item) => {
    doc.text(`- ${item}`, 24, y, { maxWidth: 160 });
    y += 10;
  });

  y += 4;
  doc.text(
    "This project not only evaluates user security posture but also educates users through behavioral simulation, bridging the gap between awareness and action.",
    20,
    y,
    { maxWidth: 170 }
  );

  doc.save("cybershield-report.pdf");
}

document.getElementById("startScanBtn").addEventListener("click", () => activateSection("checklist"));
document.querySelectorAll("[data-section-target]").forEach((button) => {
  button.addEventListener("click", () => activateSection(button.dataset.sectionTarget));
});

navLinks.forEach((button) => {
  button.addEventListener("click", () => activateSection(button.dataset.section));
});

authTabs.forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = state.authMode === "signup" ? "Creating secure account..." : "Verifying credentials...";

  try {
    const endpoint = state.authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const data = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(authForm).entries()))
    });
    persistSession(data);
    authMessage.textContent = "Access granted. Your dashboard is ready.";
    activateSection("checklist");
    loadHistory();
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

checklistForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.token) {
    scanMessage.textContent = "Please create an account or log in before running your AI scan.";
    activateSection("auth");
    return;
  }

  scanMessage.textContent = "Scanning your system...";
  try {
    const report = await api("/api/scan", {
      method: "POST",
      body: JSON.stringify({ answers: getChecklistAnswers() })
    });
    scanMessage.textContent = "Scan complete. Loading your cyber control center.";
    renderReport(report);
    loadHistory();
  } catch (error) {
    scanMessage.textContent = error.message;
  }
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  activateSection("landing");
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  themeToggle.textContent = document.body.classList.contains("light-mode") ? "Dark Mode" : "Light Mode";
  if (state.latestReport) renderCharts(state.latestReport);
});

document.getElementById("exportPdfBtn").addEventListener("click", exportPdf);

setAuthMode("login");
updateSessionUi();
loadHistory();
