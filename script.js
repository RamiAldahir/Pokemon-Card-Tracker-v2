const USERS_FILE = "users.json";
const LOCAL_COLLECTION_PREFIX = "pokemon-tracker-collection-";
const LOCAL_TOKEN_KEY = "pokemon-tracker-github-token";

const GITHUB_CONFIG = {
  owner: "RamiAldahir",
  repo: "Pokemon-Card-Tracker-v2",
  branch: "main",
  path: "users.json"
};

const GENERATIONS = {
  1: { name: "Kanto", start: 1, end: 151, ids: null },
  2: { name: "Johto", start: 152, end: 251, ids: null },
  3: { name: "Hoenn", start: 252, end: 386, ids: null },
  4: { name: "Sinnoh", start: 387, end: 493, ids: null },
  5: { name: "Unova", start: 494, end: 649, ids: null },
  6: { name: "Kalos", start: 650, end: 721, ids: null },
  7: { name: "Alola", start: 722, end: 809, ids: null },
  8: { name: "Galar", start: 810, end: 898, ids: null },
  hisui: { name: "Hisui", ids: [899, 900, 901, 902, 903, 904, 905] },
  9: { name: "Paldea", start: 906, end: 1025, ids: null }
};

const TYPE_COLORS = {
  normal: "#B7B7A4", fire: "#F08030", water: "#6890F0", electric: "#F8D030",
  grass: "#78C850", ice: "#98D8D8", fighting: "#C03028", poison: "#A040A0",
  ground: "#E0C068", flying: "#A890F0", psychic: "#F85888", bug: "#A8B820",
  rock: "#B8A038", ghost: "#705898", dragon: "#7038F8", dark: "#705848",
  steel: "#B8B8D0", fairy: "#EE99AC"
};

const state = {
  generation: 1,
  pokemon: [],
  filteredPokemon: [],
  allPokemon: [],
  cache: new Map(),
  users: {},
  currentUser: null,
  query: "",
  loading: false,
  github: null,
  githubSaving: false
};

const els = {
  title: document.getElementById("collectionTitle"),
  generation: document.getElementById("generationSelect"),
  exportButton: document.getElementById("exportButton"),
  saveButton: document.getElementById("saveButton"),
  githubButton: document.getElementById("githubButton"),
  searchInput: document.getElementById("searchInput"),
  searchButton: document.getElementById("searchButton"),
  clearSearchButton: document.getElementById("clearSearchButton"),
  grid: document.getElementById("pokemonGrid"),
  status: document.getElementById("statusMessage"),
  loginButton: document.getElementById("loginButton"),
  logoutButton: document.getElementById("logoutButton"),
  loggedInUser: document.getElementById("loggedInUser"),
  closeLoginButton: document.getElementById("closeLoginButton"),
  loginForm: document.getElementById("loginForm"),
  username: document.getElementById("usernameInput"),
  password: document.getElementById("passwordInput"),
  loginError: document.getElementById("loginError"),
  closeGithubButton: document.getElementById("closeGithubButton"),
  githubForm: document.getElementById("githubForm"),
  githubToken: document.getElementById("githubToken"),
  rememberGithubToken: document.getElementById("rememberGithubToken"),
  githubError: document.getElementById("githubError"),
  toast: document.getElementById("toast")
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("visible"), 2600);
}

function generationIds(generation) {
  if (Array.isArray(generation.ids)) return [...generation.ids];

  const ids = [];
  for (let id = generation.start; id <= generation.end; id++) ids.push(id);
  return ids;
}

function getGenerationPokemon() {
  const generation = GENERATIONS[state.generation];
  const ids = new Set(generationIds(generation));
  return state.allPokemon.filter(pokemon => ids.has(pokemon.id));
}

function getCollection() {
  if (!state.currentUser || !state.users[state.currentUser]) return {};
  return state.users[state.currentUser].collection || {};
}

function isCollected(id) {
  return Boolean(getCollection()[String(id)]);
}

function setCollected(id, value) {
  if (!state.currentUser) {
    showToast("Please log in before changing your collection.");
    return false;
  }

  const collection = getCollection();

  if (value) collection[String(id)] = true;
  else delete collection[String(id)];

  persistCollection();
  updateHeader();

  return true;
}

function persistCollection() {
  if (!state.currentUser) return;

  localStorage.setItem(
    LOCAL_COLLECTION_PREFIX + state.currentUser,
    JSON.stringify(getCollection())
  );
}

function restoreLocalCollection(username) {
  try {
    const raw = localStorage.getItem(LOCAL_COLLECTION_PREFIX + username);
    if (!raw) return;

    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      state.users[username].collection = parsed;
    }
  } catch (error) {
    console.warn("Could not restore local collection", error);
  }
}

function updateHeader() {
  const generation = GENERATIONS[state.generation];
  const shown = state.pokemon.length;
  const collectedCount = state.pokemon.filter(p => isCollected(p.id)).length;

  els.title.textContent = `${generation.name}: ${collectedCount}/${shown || generationIds(generation).length}`;

  if (state.currentUser) {
    els.loggedInUser.textContent = `Logged in as ${state.currentUser}`;
    els.loggedInUser.classList.remove("hidden");
    els.loginButton.classList.add("hidden");
    els.logoutButton.classList.remove("hidden");
  } else {
    els.loggedInUser.classList.add("hidden");
    els.loginButton.classList.remove("hidden");
    els.logoutButton.classList.add("hidden");
  }
}

function pokemonImage(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

async function fetchPokemon(id) {
  if (state.cache.has(id)) return state.cache.get(id);

  const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!response.ok) throw new Error(`Could not load Pokémon #${id}`);

  const raw = await response.json();

  const pokemon = {
    id: raw.id,
    name: raw.name,
    types: raw.types.sort((a, b) => a.slot - b.slot).map(item => item.type.name),
    image: pokemonImage(raw.id)
  };

  state.cache.set(id, pokemon);
  return pokemon;
}

function createLoadingCards(count) {
  els.grid.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < Math.min(count, 35); i++) {
    const card = document.createElement("div");
    card.className = "loading-card";
    card.innerHTML = `<div class="pokeball-loader" aria-label="Loading Pokémon" role="img"><span></span></div>`;
    fragment.appendChild(card);
  }

  els.grid.appendChild(fragment);
}

function getCardBackground(types) {
  if (types.length === 1) return TYPE_COLORS[types[0]] || "#cccccc";

  const first = TYPE_COLORS[types[0]] || "#cccccc";
  const second = TYPE_COLORS[types[1]] || first;

  return `linear-gradient(135deg, ${first} 0%, ${first} 52%, ${second} 52%, ${second} 100%)`;
}

function prettyType(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function regionForId(id) {
  for (const [key, generation] of Object.entries(GENERATIONS)) {
    if (generation.ids ? generation.ids.includes(id) : id >= generation.start && id <= generation.end) {
      return generation.name;
    }
  }

  return "Unknown";
}

function createCard(pokemon) {
  const card = document.createElement("article");
  const collected = isCollected(pokemon.id);

  card.className = `pokemon-card ${collected ? "collected" : "not-collected"}`;
  card.style.background = collected ? getCardBackground(pokemon.types) : "#b4b4b4";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `${collected ? "Remove" : "Add"} ${pokemon.name} ${collected ? "from" : "to"} your collection`);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "collection-check";
  checkbox.checked = collected;
  checkbox.setAttribute("aria-label", `Mark ${pokemon.name} as collected`);
  checkbox.title = state.currentUser ? "In collection" : "Log in to manage your collection";

  const image = document.createElement("img");
  image.className = `pokemon-image ${collected ? "" : "grayscale"}`;
  image.src = pokemon.image;
  image.alt = pokemon.name;
  image.loading = "lazy";
  image.onerror = () => { image.style.visibility = "hidden"; };

  const number = document.createElement("div");
  number.className = "pokemon-number";
  number.textContent = `#${String(pokemon.id).padStart(3, "0")}`;

  const name = document.createElement("div");
  name.className = "pokemon-name";
  name.textContent = pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1);

  const types = document.createElement("div");
  types.className = "type-labels";

  pokemon.types.forEach(type => {
    const label = document.createElement("span");
    label.className = "type-label";
    label.textContent = prettyType(type);
    types.appendChild(label);
  });

  function toggleCollection() {
    const newValue = !checkbox.checked;

    if (!setCollected(pokemon.id, newValue)) return;

    checkbox.checked = newValue;
    card.classList.toggle("collected", newValue);
    card.classList.toggle("not-collected", !newValue);
    card.style.background = newValue ? getCardBackground(pokemon.types) : "#b4b4b4";
    image.classList.toggle("grayscale", !newValue);
    card.setAttribute("aria-label", `${newValue ? "Remove" : "Add"} ${pokemon.name} ${newValue ? "from" : "to"} your collection`);
  }

  checkbox.addEventListener("click", event => {
    event.stopPropagation();
  });

  checkbox.addEventListener("change", () => {
    const newValue = checkbox.checked;

    if (!setCollected(pokemon.id, newValue)) {
      checkbox.checked = !newValue;
      return;
    }

    card.classList.toggle("collected", newValue);
    card.classList.toggle("not-collected", !newValue);
    card.style.background = newValue ? getCardBackground(pokemon.types) : "#b4b4b4";
    image.classList.toggle("grayscale", !newValue);
    card.setAttribute("aria-label", `${newValue ? "Remove" : "Add"} ${pokemon.name} ${newValue ? "from" : "to"} your collection`);
  });

  card.addEventListener("click", toggleCollection);

  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCollection();
    }
  });

  card.append(checkbox, image, number, name, types);
  return card;
}

function renderCards() {
  els.grid.innerHTML = "";

  if (!state.filteredPokemon.length) {
    const noResults = document.createElement("div");
    noResults.className = "no-results";
    noResults.textContent = state.query ? `No Pokémon found for "${state.query}".` : "No Pokémon to display.";
    els.grid.appendChild(noResults);
    updateHeader();
    return;
  }

  const fragment = document.createDocumentFragment();
  state.filteredPokemon.forEach(pokemon => fragment.appendChild(createCard(pokemon)));
  els.grid.appendChild(fragment);

  updateHeader();
}

function applySearch() {
  state.query = els.searchInput.value.trim().toLowerCase();
  const terms = state.query.replace(/^#/, "").split(/\s+/).filter(Boolean);

  if (!terms.length) {
    state.pokemon = getGenerationPokemon();
    state.filteredPokemon = [...state.pokemon];
    els.clearSearchButton.style.display = "none";
    els.status.textContent = "";
    renderCards();
    return;
  }

  state.pokemon = state.allPokemon;

  state.filteredPokemon = state.allPokemon.filter(pokemon => {
    const haystack = `${pokemon.name} ${pokemon.id} ${regionForId(pokemon.id)} ${pokemon.types.join(" ")}`.toLowerCase();
    return terms.every(term => haystack.includes(term));
  });

  els.clearSearchButton.style.display = "inline-block";
  els.status.textContent = `${state.filteredPokemon.length} result${state.filteredPokemon.length === 1 ? "" : "s"} across all generations.`;
  renderCards();
}

async function loadGeneration(generationKey) {
  state.generation = generationKey;

  const generation = GENERATIONS[state.generation];
  const ids = generationIds(generation);

  state.loading = true;
  updateHeader();
  createLoadingCards(ids.length);
  els.status.textContent = `Loading ${generation.name}…`;

  try {
    const results = [];
    const batchSize = 20;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchResults = await Promise.all(ids.slice(i, i + batchSize).map(fetchPokemon));
      results.push(...batchResults);
      els.status.textContent = `Loading ${generation.name}… ${Math.min(i + batchSize, ids.length)}/${ids.length}`;
    }

    const byId = new Map(state.allPokemon.map(p => [p.id, p]));
    results.forEach(p => byId.set(p.id, p));

    state.allPokemon = [...byId.values()].sort((a, b) => a.id - b.id);
    state.pokemon = results.sort((a, b) => a.id - b.id);
    state.filteredPokemon = [...state.pokemon];
    state.loading = false;

    applySearch();
  } catch (error) {
    console.error(error);
    state.loading = false;
    els.grid.innerHTML = "";
    els.status.textContent = "Unable to load Pokémon. Check your internet connection and try again.";
  }
}

async function ensureAllPokemonLoaded() {
  const missing = [];

  for (let id = 1; id <= 1025; id++) {
    if (!state.cache.has(id)) missing.push(id);
  }

  if (!missing.length) return;

  els.status.textContent = `Loading Pokédex for search… 0/${missing.length}`;

  const batchSize = 25;

  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fetchPokemon));
    const byId = new Map(state.allPokemon.map(p => [p.id, p]));

    results.forEach(p => byId.set(p.id, p));

    state.allPokemon = [...byId.values()].sort((a, b) => a.id - b.id);
    els.status.textContent = `Loading Pokédex for search… ${Math.min(i + batchSize, missing.length)}/${missing.length}`;
  }
}

function openLogin() {
  els.loginError.textContent = "";
  els.username.value = "";
  els.password.value = "";

  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.remove("hidden");

  setTimeout(() => els.username.focus(), 0);
}

function closeLogin() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.add("hidden");
}

function login(username, password) {
  const user = state.users[username];

  if (!user || user.password !== password) {
    els.loginError.textContent = "Incorrect username or password.";
    return;
  }

  state.currentUser = username;
  restoreLocalCollection(username);
  closeLogin();
  updateHeader();
  renderCards();

  showToast(`Logged in as ${username}.`);
}

function logout() {
  state.currentUser = null;
  updateHeader();
  renderCards();
  showToast("Logged out.");
}

async function saveCollection() {
  if (!state.currentUser) {
    showToast("Log in first to save your collection.");
    return;
  }

  persistCollection();

  if (state.github) {
    await syncToGitHub();
  } else {
    showToast("Collection saved on this device.");
  }
}

function exportCollection() {
  if (!state.currentUser) return showToast("Please log in before exporting your collection.");
  if (!window.XLSX) return showToast("Excel export library has not loaded.");

  const rows = state.filteredPokemon.map(pokemon => ({
    "Pokédex #": pokemon.id,
    "Pokémon": pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1),
    "Region": regionForId(pokemon.id),
    "Type 1": prettyType(pokemon.types[0]),
    "Type 2": pokemon.types[1] ? prettyType(pokemon.types[1]) : "",
    "In Collection": isCollected(pokemon.id)
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Collection");

  const username = state.currentUser.replace(/[^a-z0-9_-]/gi, "_");
  XLSX.writeFile(workbook, `${username}_Pokemon_Collection.xlsx`);

  showToast("Excel file exported.");
}

function loadGithubConfig() {
  const token = localStorage.getItem(LOCAL_TOKEN_KEY);

  state.github = {
    ...GITHUB_CONFIG,
    token: token || ""
  };
}

function openGithub() {
  els.githubToken.value = state.github?.token || "";
  els.rememberGithubToken.checked = Boolean(localStorage.getItem(LOCAL_TOKEN_KEY));
  els.githubError.textContent = "";

  const modal = document.getElementById("githubModal");
  if (modal) modal.classList.remove("hidden");

  setTimeout(() => els.githubToken.focus(), 0);
}

function closeGithub() {
  const modal = document.getElementById("githubModal");
  if (modal) modal.classList.add("hidden");
}

async function getGithubFile(config) {
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${config.path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(config.branch)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("GitHub API error:", response.status, detail);
    throw new Error(`GitHub returned ${response.status}: ${detail}`);
    }

  return response.json();
}

async function syncToGitHub() {
  if (!state.github || !state.currentUser) return;

  if (!state.github.token) {
    showToast("GitHub token not configured.");
    return;
  }

  if (state.githubSaving) return;

  state.githubSaving = true;

  try {
    const file = await getGithubFile(state.github);
    const users = JSON.parse(atob(file.content.replace(/\n/g, "")));

    if (!users[state.currentUser]) users[state.currentUser] = {};
    users[state.currentUser].collection = getCollection();

    const json = JSON.stringify(users, null, 2) + "\n";
    const content = btoa(unescape(encodeURIComponent(json)));

    const url = `https://api.github.com/repos/${encodeURIComponent(state.github.owner)}/${encodeURIComponent(state.github.repo)}/contents/${state.github.path.split("/").map(encodeURIComponent).join("/")}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${state.github.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Update ${state.currentUser} Pokémon collection`,
        content,
        sha: file.sha,
        branch: state.github.branch
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub returned ${response.status}: ${detail.slice(0, 180)}`);
    }

    showToast("Collection synced to GitHub.");
  } catch (error) {
    console.error(error);
    showToast("Saved locally, but GitHub sync failed.");
  } finally {
    state.githubSaving = false;
  }
}

els.generation.addEventListener("change", event => {
  state.query = "";
  els.searchInput.value = "";
  loadGeneration(event.target.value);
});

els.searchButton.addEventListener("click", async () => {
  if (els.searchInput.value.trim() && state.allPokemon.length < 1025) {
    try {
      await ensureAllPokemonLoaded();
    } catch (error) {
      console.error(error);
    }
  }

  applySearch();
});

els.searchInput.addEventListener("keydown", async event => {
  if (event.key !== "Enter") return;

  event.preventDefault();

  if (els.searchInput.value.trim() && state.allPokemon.length < 1025) {
    try {
      await ensureAllPokemonLoaded();
    } catch (error) {
      console.error(error);
    }
  }

  applySearch();
});

els.clearSearchButton.addEventListener("click", () => {
  els.searchInput.value = "";
  applySearch();
  els.searchInput.focus();
});

els.loginButton.addEventListener("click", openLogin);
els.closeLoginButton.addEventListener("click", closeLogin);
els.logoutButton.addEventListener("click", logout);
els.saveButton.addEventListener("click", saveCollection);
els.exportButton.addEventListener("click", exportCollection);
els.githubButton.addEventListener("click", openGithub);
els.closeGithubButton.addEventListener("click", closeGithub);

els.loginForm.addEventListener("submit", event => {
  event.preventDefault();
  login(els.username.value.trim(), els.password.value);
});

els.githubForm.addEventListener("submit", async event => {
  event.preventDefault();

  els.githubError.textContent = "Testing GitHub access…";

  const token = els.githubToken.value.trim();

  if (!token) {
    els.githubError.textContent = "Please enter your GitHub token.";
    return;
  }

  const config = {
    ...GITHUB_CONFIG,
    token
  };

  try {
    await getGithubFile(config);

    state.github = config;

    if (els.rememberGithubToken.checked) {
      localStorage.setItem(LOCAL_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(LOCAL_TOKEN_KEY);
    }

    closeGithub();
    showToast("GitHub Sync connected.");

    if (state.currentUser) await syncToGitHub();
  } catch (error) {
    console.error(error);
    els.githubError.textContent = error.message || "Could not access the GitHub file.";
  }
});

const loginModal = document.getElementById("loginModal");
const githubModal = document.getElementById("githubModal");

[loginModal, githubModal].filter(Boolean).forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) modal.classList.add("hidden");
  });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeLogin();
    closeGithub();
  }
});

async function init() {
  loadGithubConfig();

  try {
    const response = await fetch(USERS_FILE, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Could not load ${USERS_FILE}`);
    }

    state.users = await response.json();
    Object.keys(state.users).forEach(restoreLocalCollection);
  } catch (error) {
    console.error(error);
    els.status.textContent = "Could not load users.json. Run the site through GitHub Pages or a local web server.";
    return;
  }

  updateHeader();
  await loadGeneration(1);
}

init();