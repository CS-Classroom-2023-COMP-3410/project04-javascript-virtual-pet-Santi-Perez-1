// Virtual Pet Dashboard
// Requirements:
// - DOM manipulation + event listeners
// - State management (single JS object)
// - setInterval + setTimeout for time-based changes
// - localStorage persistence across refresh

const STORAGE_KEY = "virtualPetState_v1";

const $ = (id) => document.getElementById(id);

// DOM
const petEl = $("pet");
const petMessageEl = $("petMessage");

const moodChipEl = $("moodChip");
const moodTextEl = $("moodText");
const conditionTextEl = $("conditionText");
const ageTextEl = $("ageText");

const healthTextEl = $("healthText");
const hungerTextEl = $("hungerText");
const energyTextEl = $("energyText");
const cleanTextEl = $("cleanText");

const healthBarEl = $("healthBar");
const hungerBarEl = $("hungerBar");
const energyBarEl = $("energyBar");
const cleanBarEl = $("cleanBar");

const feedBtn = $("feedBtn");
const playBtn = $("playBtn");
const sleepBtn = $("sleepBtn");
const healBtn = $("healBtn");
const resetBtn = $("resetBtn");
const pauseBtn = $("pauseBtn");

// State
const defaultState = () => ({
  health: 100,      // 0-100
  hunger: 0,        // 0-100 (higher = more hungry)
  energy: 80,       // 0-100
  clean: 80,        // 0-100
  mood: "Happy",    // computed mostly
  createdAt: Date.now(),
  lastTickAt: Date.now(),
  isSleeping: false,
  paused: false
});

let state = loadState() ?? defaultState();

let tickInterval = null;

//  Persistence 
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save state:", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Basic validation / fallback
    if (typeof parsed !== "object" || parsed === null) return null;

    // If time passed while page was closed, simulate some ticks
    // based on elapsed minutes (lightweight “offline progression”)
    const now = Date.now();
    const last = parsed.lastTickAt ?? now;
    const minutes = Math.min(60, Math.floor((now - last) / 60000)); // cap 60 mins
    let fixed = { ...defaultState(), ...parsed };
    for (let i = 0; i < minutes; i++) {
      fixed = applyNaturalDecay(fixed);
    }
    fixed.lastTickAt = now;
    return fixed;
  } catch (e) {
    console.warn("Could not load state:", e);
    return null;
  }
}

//  Helpers 
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function setMessage(text) {
  petMessageEl.textContent = text;
}

function flashAnimation(className) {
  petEl.classList.remove("anim-shake", "anim-bounce");
  // trigger reflow so animation restarts
  void petEl.offsetWidth;
  petEl.classList.add(className);
  setTimeout(() => petEl.classList.remove(className), 500);
}

// Compute mood/condition from stats
function computeMoodAndCondition(s) {
  const { health, hunger, energy, clean, isSleeping } = s;

  if (isSleeping) return { mood: "Sleepy", condition: "Sleeping..." };

  if (health <= 25) return { mood: "Sick", condition: "Needs care!" };
  if (hunger >= 75) return { mood: "Hungry", condition: "Feed me!" };
  if (energy <= 25) return { mood: "Sleepy", condition: "Very tired" };
  if (clean <= 25) return { mood: "Sick", condition: "Dirty & cranky" };

  // “Happy” if everything is pretty good
  if (health >= 70 && hunger <= 40 && energy >= 40) {
    return { mood: "Happy", condition: "Great" };
  }

  return { mood: "Okay", condition: "Doing fine" };
}

// Set bar fill + color feel by changing gradient endpoints indirectly (we’ll just adjust width)
function updateBars() {
  healthBarEl.style.width = `${state.health}%`;
  hungerBarEl.style.width = `${state.hunger}%`;
  energyBarEl.style.width = `${state.energy}%`;
  cleanBarEl.style.width = `${state.clean}%`;

  healthTextEl.textContent = state.health;
  hungerTextEl.textContent = state.hunger;
  energyTextEl.textContent = state.energy;
  cleanTextEl.textContent = state.clean;
}

// Change pet class for mood visuals
function updatePetLook(mood) {
  petEl.classList.remove("happy", "hungry", "sleepy", "sick");

  if (mood === "Happy") petEl.classList.add("happy");
  else if (mood === "Hungry") petEl.classList.add("hungry");
  else if (mood === "Sleepy") petEl.classList.add("sleepy");
  else if (mood === "Sick") petEl.classList.add("sick");
}

// Render all UI
function render() {
  // Age in minutes since createdAt
  const ageMinutes = Math.max(0, Math.floor((Date.now() - state.createdAt) / 60000));
  ageTextEl.textContent = ageMinutes.toString();

  const { mood, condition } = computeMoodAndCondition(state);
  state.mood = mood;

  moodTextEl.textContent = mood;
  conditionTextEl.textContent = condition;

  moodChipEl.textContent = mood;
  moodChipEl.style.borderColor = "rgba(255,255,255,0.16)";

  updatePetLook(mood);
  updateBars();

  // Button states
  sleepBtn.textContent = state.isSleeping ? "🌤 Wake" : "😴 Sleep";
  pauseBtn.textContent = state.paused ? "▶ Resume Time" : "⏸ Pause Time";

  saveState();
}

//  Time-based changes 
function applyNaturalDecay(s) {
  // When sleeping: energy up faster, hunger up slower, health stable
  if (s.isSleeping) {
    return {
      ...s,
      hunger: clamp(s.hunger + 2, 0, 100),
      energy: clamp(s.energy + 6, 0, 100),
      clean: clamp(s.clean - 1, 0, 100),
      health: clamp(s.health + 1, 0, 100)
    };
  }

  // Awake: hunger rises, energy/clean drop gradually
  let next = {
    ...s,
    hunger: clamp(s.hunger + 3, 0, 100),
    energy: clamp(s.energy - 2, 0, 100),
    clean: clamp(s.clean - 1, 0, 100)
  };

  // If very hungry, health decays
  if (next.hunger >= 80) {
    next.health = clamp(next.health - 3, 0, 100);
  } else if (next.hunger >= 60) {
    next.health = clamp(next.health - 1, 0, 100);
  }

  // If very low energy, health decays a bit
  if (next.energy <= 10) {
    next.health = clamp(next.health - 2, 0, 100);
  }

  // If very dirty, health decays a bit
  if (next.clean <= 10) {
    next.health = clamp(next.health - 2, 0, 100);
  }

  return next;
}

function startTicking() {
  if (tickInterval) clearInterval(tickInterval);

  // Every 5 seconds: update stats
  tickInterval = setInterval(() => {
    if (state.paused) return;

    state = applyNaturalDecay(state);
    state.lastTickAt = Date.now();

    // Auto-wake if fully rested
    if (state.isSleeping && state.energy >= 98) {
      state.isSleeping = false;
      setMessage("I feel rested! 🌤");
      flashAnimation("anim-bounce");
    }

    // If health hits 0, freeze and show message
    if (state.health <= 0) {
      state.health = 0;
      state.paused = true;
      state.isSleeping = false;
      setMessage("Oh no... I need a reset. 💀");
    }

    render();
  }, 5000);
}

//  Actions 
function feed() {
  if (state.health <= 0) return;

  state.hunger = clamp(state.hunger - 25, 0, 100);
  state.clean = clamp(state.clean - 5, 0, 100); // eating makes a little mess
  state.energy = clamp(state.energy + 5, 0, 100);

  setMessage("Yum! Thanks for feeding me 🍎");
  flashAnimation("anim-bounce");
  render();
}

function play() {
  if (state.health <= 0) return;

  // If too tired, warn
  if (state.energy <= 10) {
    setMessage("Too tired to play... maybe let me sleep 😴");
    flashAnimation("anim-shake");
    return;
  }

  state.energy = clamp(state.energy - 18, 0, 100);
  state.hunger = clamp(state.hunger + 8, 0, 100);
  state.clean = clamp(state.clean - 10, 0, 100);
  state.health = clamp(state.health + 3, 0, 100);

  setMessage("That was fun! 🎾");
  flashAnimation("anim-bounce");
  render();
}

function toggleSleep() {
  if (state.health <= 0) return;

  state.isSleeping = !state.isSleeping;

  if (state.isSleeping) {
    setMessage("Zzz... 😴");
  } else {
    setMessage("I’m awake! 🌤");
    flashAnimation("anim-bounce");
  }

  render();
}

function heal() {
  if (state.health <= 0) return;

  // Healing costs energy but restores health + cleanliness a bit
  if (state.energy <= 8) {
    setMessage("Too tired to heal... sleep first 😴");
    flashAnimation("anim-shake");
    return;
  }

  state.health = clamp(state.health + 18, 0, 100);
  state.clean = clamp(state.clean + 12, 0, 100);
  state.energy = clamp(state.energy - 10, 0, 100);

  setMessage("Feeling better already 🩹");
  flashAnimation("anim-bounce");
  render();
}

function togglePause() {
  state.paused = !state.paused;
  setMessage(state.paused ? "Time paused ⏸" : "Time resumed ▶");
  render();
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  setMessage("Fresh start! Say hi 👋");
  render();
}

//  Event Listeners 
feedBtn.addEventListener("click", feed);
playBtn.addEventListener("click", play);
sleepBtn.addEventListener("click", toggleSleep);
healBtn.addEventListener("click", heal);
pauseBtn.addEventListener("click", togglePause);
resetBtn.addEventListener("click", resetAll);

//  Boot 
render();
startTicking();
