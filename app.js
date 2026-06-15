const BATTLE_API_URL = "https://script.google.com/macros/s/AKfycbyDt21rBSjMjRZmdW5lvlsJINRdyHi-QI057QZZeOVO7oMeuj6expxIGWHHw0zd5mStHg/exec";
const $ = (selector) => document.querySelector(selector);
const state = { user: null, players: [], battleId: "", rawBattle: null, overviewView: "alliances", authMode: "login" };

async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

async function initializeAuth() {
  try {
    const result = await api("session");
    showApp(result.user, result.members);
  } catch {
    $("#authOverlay").classList.remove("hidden");
  }
}

function showApp(user, members = []) {
  state.user = user;
  state.players = normalizePlayers(members);
  $("#currentUser").textContent = user.username;
  $("#authOverlay").classList.add("hidden");
  $("#appShell").classList.remove("hidden");
  renderMemberList();
  const params = new URLSearchParams(location.search);
  const battle = params.get("battle");
  if (battle) {
    $("#battleInput").value = `https://east.albionbb.com/battles/${battle}`;
    if (state.players.length) loadBattle();
  }
}

function normalizePlayers(players) {
  const seen = new Set();
  return players.map((name) => String(name).trim()).filter((name) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function saveMembers() {
  state.players = normalizePlayers(state.players);
  await api("members", { method: "PUT", body: JSON.stringify({ members: state.players }) });
  renderMemberList();
  if (state.rawBattle) renderPlayers(Object.values(state.rawBattle.players || {}));
}

async function addMember(name) {
  const cleanName = String(name).trim();
  if (!cleanName) return;
  if (state.players.some((player) => player.toLowerCase() === cleanName.toLowerCase())) {
    return setStatus(`${cleanName} is already saved.`, true);
  }
  state.players.push(cleanName);
  await saveMembers();
  setStatus(`${cleanName} was added and synced.`);
}

async function removeMember(index) {
  const [removed] = state.players.splice(index, 1);
  await saveMembers();
  setStatus(`${removed} was removed.`);
}

function renderMemberList() {
  $("#memberList").innerHTML = state.players.length ? state.players.map((name, index) => `
    <div class="member-chip"><span>${escapeHtml(name)}</span><button type="button" data-remove-member="${index}" aria-label="Remove ${escapeHtml(name)}">×</button></div>
  `).join("") : `<div class="member-empty">Add a member to begin.</div>`;
}

function getBattleIds(value) { return value.match(/\d{7,}/g) || []; }
function formatNumber(value) { return Number(value || 0).toLocaleString("en-US"); }
function formatCompact(value) { return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0).toLowerCase(); }
function setStatus(message, error = false) { $("#status").textContent = message; $("#status").classList.toggle("error", error); }
function setAuthStatus(message, error = false) { $("#authStatus").textContent = message; $("#authStatus").classList.toggle("error", error); }

async function postBattleApi(payload) {
  const response = await fetch(BATTLE_API_URL, { method: "POST", body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Battle API error (${response.status})`);
  const result = await response.json();
  if (result.status === "error") throw new Error(result.message || "Could not load battle data.");
  return result;
}

async function loadBattle() {
  const ids = getBattleIds($("#battleInput").value);
  if (!ids.length) return setStatus("Enter a valid Battle ID or URL.", true);
  if (!state.players.length) return setStatus("Add at least one saved member first.", true);
  state.battleId = ids.join(",");
  $("#battleInput").value = `https://east.albionbb.com/battles/${state.battleId}`;
  setStatus("Loading battle data...");
  try {
    const [memberResult, overviewResult] = await Promise.all([
      postBattleApi({ input: state.battleId, players: state.players }),
      postBattleApi({ input: state.battleId, players: [], action: "overview" })
    ]);
    state.rawBattle = overviewResult.rawBattle;
    renderPlayers(memberResult.data || []);
    renderOverview();
    updateUrl();
    $("#overviewPanel").classList.remove("hidden");
    $("#playersPanel").classList.remove("hidden");
    $("#battleLabel").textContent = `Battle #${state.battleId}`;
    $("#updatedAt").textContent = `✓ Last updated: ${new Date().toLocaleTimeString("en-US")}`;
    setStatus("Battle data loaded.");
  } catch (error) { setStatus(error.message || "Could not load battle data.", true); }
}

function renderPlayers(players) {
  const resultByName = new Map(players.map((player) => [player.name.toLowerCase(), player]));
  const selected = state.players.map((name) => resultByName.get(name.toLowerCase()) || { name, kills: 0, deaths: 0, killFame: 0, missing: true });
  selected.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || b.killFame - a.killFame);
  $("#playersTitle").textContent = `Saved Members (${selected.length})`;
  const kills = selected.reduce((sum, player) => sum + Number(player.kills || 0), 0);
  const deaths = selected.reduce((sum, player) => sum + Number(player.deaths || 0), 0);
  $("#totals").innerHTML = `<span class="kills">${kills} Kill</span> / <span class="deaths">${deaths} Death</span>`;
  $("#playersBody").innerHTML = selected.map((player) => `
    <tr class="${player.missing ? "missing-player" : ""}"><td>${escapeHtml(player.name)}${player.missing ? ` <small>No battle record</small>` : ""}</td><td class="kills">${formatNumber(player.kills)}</td><td class="deaths">${formatNumber(player.deaths)}</td><td class="fame">${formatNumber(player.killFame)}</td></tr>
  `).join("");
}

function renderOverview() {
  if (!state.rawBattle) return;
  const view = state.overviewView;
  const players = Object.values(state.rawBattle.players || {});
  const entries = Object.values(state.rawBattle[view] || {});
  if (view === "alliances") {
    const unallied = players.filter((player) => !player.allianceId);
    if (unallied.length) entries.push({ id: "", name: "No Alliance", kills: unallied.reduce((s, p) => s + Number(p.kills || 0), 0), deaths: unallied.reduce((s, p) => s + Number(p.deaths || 0), 0), killFame: unallied.reduce((s, p) => s + Number(p.killFame || 0), 0) });
  }
  const countPlayers = (entry) => players.filter((player) => view === "alliances" ? (player.allianceId || "") === entry.id : player.guildId === entry.id).length;
  const rows = entries.map((entry) => ({ ...entry, playerCount: countPlayers(entry) })).sort((a, b) => b.killFame - a.killFame || b.kills - a.kills);
  $("#groupHeader").textContent = view === "alliances" ? "Alliance" : "Guild";
  $("#overviewBody").innerHTML = rows.map((row) => `<tr><td>${escapeHtml(row.name || "No Alliance")}</td><td class="players">${formatNumber(row.playerCount)}</td><td class="kills">${formatNumber(row.kills)}</td><td class="deaths">${formatNumber(row.deaths)}</td><td class="fame">${formatCompact(row.killFame)}</td></tr>`).join("");
}

function updateUrl() {
  const url = new URL(location.href);
  url.searchParams.set("battle", state.battleId);
  url.searchParams.delete("players");
  history.replaceState({}, "", url);
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthStatus(state.authMode === "login" ? "Signing in..." : "Creating account...");
  try {
    const result = await api(state.authMode, { method: "POST", body: JSON.stringify({ username: $("#usernameInput").value, password: $("#passwordInput").value }) });
    showApp(result.user, result.members);
  } catch (error) { setAuthStatus(error.message, true); }
});
$("#authModeButton").addEventListener("click", () => {
  state.authMode = state.authMode === "login" ? "register" : "login";
  const registering = state.authMode === "register";
  $("#authTitle").textContent = registering ? "Create account" : "Sign in";
  $("#authDescription").textContent = registering ? "Create an account to sync your member list." : "Sign in to load your saved member list.";
  $("#authSubmit").textContent = registering ? "Create account" : "Sign in";
  $("#authModeButton").textContent = registering ? "Already have an account? Sign in" : "Create a new account";
  $("#passwordInput").autocomplete = registering ? "new-password" : "current-password";
  setAuthStatus("");
});
$("#logoutButton").addEventListener("click", async () => { await api("logout", { method: "POST", body: "{}" }); location.reload(); });
$("#searchForm").addEventListener("submit", (event) => { event.preventDefault(); loadBattle(); });
$("#memberForm").addEventListener("submit", async (event) => { event.preventDefault(); try { await addMember($("#memberInput").value); $("#memberInput").value = ""; } catch (error) { setStatus(error.message, true); } });
$("#memberList").addEventListener("click", async (event) => { const button = event.target.closest("[data-remove-member]"); if (button) try { await removeMember(Number(button.dataset.removeMember)); } catch (error) { setStatus(error.message, true); } });
$("#refreshButton").addEventListener("click", loadBattle);
$("#clearPlayersButton").addEventListener("click", async () => { state.players = []; try { await saveMembers(); setStatus("All members removed."); } catch (error) { setStatus(error.message, true); } });
$("#shareButton").addEventListener("click", async () => { const ids = getBattleIds($("#battleInput").value); if (!ids.length) return setStatus("Enter a battle first.", true); state.battleId = ids.join(","); updateUrl(); await navigator.clipboard.writeText(location.href); setStatus("Battle link copied. Member lists remain private to each account."); });
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => { document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active")); tab.classList.add("active"); state.overviewView = tab.dataset.view; renderOverview(); }));
$("#saveButton").addEventListener("click", async () => { if (!window.html2canvas) return setStatus("Image tool failed to load.", true); const canvas = await html2canvas($("#playersPanel"), { backgroundColor: "#070b14", scale: 2 }); const link = document.createElement("a"); link.download = `battle-${state.battleId}-members.png`; link.href = canvas.toDataURL("image/png"); link.click(); });

window.addEventListener("DOMContentLoaded", initializeAuth);
