// scoreboard.js
// ===============================================
// Shrimp Pantheon - Scoreboard + Hall of Fame
// ===============================================
//
// IMPORTANT:
// This file expects your website to be opened through
// a *local web server*, not directly as a file:/// URL.
// Example:
//   http://127.0.0.1:5500/scoreboard.html
// or
//   http://localhost:8000/scoreboard.html
//
// It uses `fetch()` to load CSV files from disk,
// which only works over http/https, not file://.
// ===============================================

"use strict";

/* -------------------------------------------------
   1. BASIC CONFIGURATION
-------------------------------------------------- */

// First year you started tracking splits.
// The Hall of Fame will list from this year up to the current year.
const SCOREBOARD_FIRST_YEAR = 2024;

// Folder where your CSV files live, relative to scoreboard.html.
// Example: data/2024_Split1.csv, data/2024_Split2.csv, etc.
const SCOREBOARD_DATA_FOLDER = "data";

/* -------------------------------------------------
   2. PLAYER NICKNAMES / ALIASES
-------------------------------------------------- */
/*
   This object lets you give players “code names”.
   - The key must match exactly the PlayerID in your CSV.
   - The value is the nickname you want to display.

   Example mapping:
     "Alex E."  → "Shrimp"
     "Nainoa"   → "Rat"
     "Isabelle" → "Snake"
*/
const PLAYER_ALIASES = {
  "Alex E.": "Shrimp",
  Nainoa: "Rat",
  Isabelle: "Snake",
  // Add new nicknames like this:
  // "Alex B.": "Bear",
  // "Teresa": "Lioness",
};

/**
 * getDisplayName(realName)
 * -------------------------
 * Returns nickname if one exists, otherwise returns the original name.
 */
function getDisplayName(realName) {
  return PLAYER_ALIASES[realName] || realName;
}

/* -------------------------------------------------
   3. PAGE INITIALISATION
-------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  initScoreboardPage();
});

/**
 * initScoreboardPage()
 * --------------------
 * - Finds the scoreboard elements in the HTML.
 * - Determines the current split (year + split number).
 * - Loads scores for the current split into the main table.
 * - Builds the Hall of Fame section for all splits from
 *   SCOREBOARD_FIRST_YEAR up to the current split.
 */
function initScoreboardPage() {
  const yearEl = document.getElementById("scoreboard-year");
  const splitEl = document.getElementById("scoreboard-split");
  const statusEl = document.getElementById("scoreboard-status");
  const tbodyEl = document.getElementById("scoreboard-body");
  const hofContainer = document.getElementById("scoreboard-hof-content");

  // If these elements don't exist, we are probably not on the scoreboard page.
  if (!yearEl || !splitEl || !statusEl || !tbodyEl || !hofContainer) {
    return;
  }

  // Work out the current year and split number.
  const currentInfo = getCurrentSplitInfo();
  yearEl.textContent = currentInfo.year;
  splitEl.textContent = String(currentInfo.split);

  // Path to the CSV for the current split, for example:
  // data/2025_Split2.csv
  const currentCsvPath = buildCsvPath(currentInfo.year, currentInfo.split);
  statusEl.textContent = `Loading scores from ${currentCsvPath}…`;

  // Load the main scoreboard table for the current split.
  loadSplitIntoMainTable(currentCsvPath, statusEl, tbodyEl);

  // Build the Hall of Fame for all splits from first year to now.
  buildHallOfFame(hofContainer, currentInfo);
}

/* -------------------------------------------------
   4. CURRENT SPLIT SCOREBOARD
-------------------------------------------------- */

/**
 * getCurrentSplitInfo()
 * ---------------------
 * Determines which split we are currently in, based on today's date.
 * - Split 1: January 1  → June 30
 * - Split 2: July 1     → December 31
 */
function getCurrentSplitInfo(today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // months are 0–11, so add 1
  const split = month >= 7 ? 2 : 1;
  return { year, split };
}

/**
 * buildCsvPath(year, split)
 * -------------------------
 * Builds the relative path to the CSV file for a given year + split.
 * Example: data/2024_Split1.csv
 */
function buildCsvPath(year, split) {
  const trimmed = SCOREBOARD_DATA_FOLDER.replace(/\/+$/, ""); // remove trailing slashes
  const filename = `${year}_Split${split}.csv`;
  return trimmed ? `${trimmed}/${filename}` : filename;
}

/**
 * loadSplitIntoMainTable(csvPath, statusEl, tbodyEl)
 * --------------------------------------------------
 * Loads one CSV file and fills the main scoreboard table.
 */
async function loadSplitIntoMainTable(csvPath, statusEl, tbodyEl) {
  try {
    const response = await fetch(csvPath, { cache: "no-cache" });

    if (!response.ok) {
      // For example, the file doesn't exist yet.
      statusEl.textContent = "Unable to load scores for this split. Please check that the CSV file exists.";
      statusEl.classList.add("scoreboard-status--error");
      console.warn("Scoreboard: fetch failed for", csvPath, response.status);
      return;
    }

    const text = await response.text();
    const records = parseCsv(text);

    if (!records.length) {
      statusEl.textContent = "No scores recorded for this split yet.";
      statusEl.classList.remove("scoreboard-status--error");
      tbodyEl.innerHTML = "";
      return;
    }

    const totalsMap = tallyScores(records);
    const ranked = createRankedArray(totalsMap);

    renderMainTableRows(ranked, tbodyEl);

    statusEl.textContent = `Scores loaded from ${csvPath}.`;
    statusEl.classList.remove("scoreboard-status--error");
  } catch (err) {
    console.error("Scoreboard: error loading current split:", err);
    statusEl.textContent = "Unable to load scores for this split.";
    statusEl.classList.add("scoreboard-status--error");
  }
}

/**
 * renderMainTableRows(ranked, tbodyEl)
 * ------------------------------------
 * Takes a ranked array and draws one table row per player.
 */
function renderMainTableRows(ranked, tbodyEl) {
  // Clear any existing rows.
  tbodyEl.innerHTML = "";

  ranked.forEach((row) => {
    const tr = document.createElement("tr");

    const rankTd = document.createElement("td");
    rankTd.className = "scoreboard-rank-cell";
    rankTd.textContent = `#${row.rank}`;

    const nameTd = document.createElement("td");
    nameTd.className = "scoreboard-name-cell";
    nameTd.textContent = getDisplayName(row.player); // <-- nicknames used here

    const scoreTd = document.createElement("td");
    scoreTd.className = "scoreboard-score-cell";
    scoreTd.textContent = row.total.toString();

    tr.append(rankTd, nameTd, scoreTd);
    tbodyEl.appendChild(tr);
  });
}

/* -------------------------------------------------
   5. HALL OF FAME LOGIC
-------------------------------------------------- */

/**
 * buildHallOfFame(container, currentInfo)
 * ---------------------------------------
 * For each split from SCOREBOARD_FIRST_YEAR up to the current split:
 *  - Completed past splits with CSV data → show top 1–2 players
 *  - Completed past splits with no CSV → "Off split"
 *  - The current split                  → "In progress"
 */
async function buildHallOfFame(container, currentInfo) {
  const { year: currentYear, split: currentSplit } = currentInfo;

  // Build a list of all splits from first year → current split.
  const splitsToCheck = [];
  for (let year = SCOREBOARD_FIRST_YEAR; year <= currentYear; year++) {
    for (let split = 1; split <= 2; split++) {
      // Skip splits that are in the future.
      if (year > currentYear || (year === currentYear && split > currentSplit)) {
        continue;
      }
      splitsToCheck.push({ year, split });
    }
  }

  if (!splitsToCheck.length) {
    container.innerHTML = '<p class="scoreboard-hof-status">No splits recorded yet.</p>';
    return;
  }

  try {
    // Load a summary for each split.
    const summaries = await Promise.all(splitsToCheck.map(({ year, split }) => summariseSplitForHallOfFame(year, split, currentInfo)));

    // Clear any placeholder text.
    container.innerHTML = "";

    // Render each split summary into the Hall of Fame.
    summaries.forEach((summary) => {
      const entryEl = renderHallOfFameEntry(summary);
      container.appendChild(entryEl);
    });
  } catch (err) {
    console.error("Scoreboard: error building Hall of Fame:", err);
    container.innerHTML = '<p class="scoreboard-hof-status">Unable to load Hall of Fame data.</p>';
  }
}

/**
 * summariseSplitForHallOfFame(year, split, currentInfo)
 * -----------------------------------------------------
 * Returns an object like:
 *   { year, split, status: "in-progress" }
 *   { year, split, status: "off-split" }
 *   { year, split, status: "completed", players: [...] }
 */
async function summariseSplitForHallOfFame(year, split, currentInfo) {
  const isCurrentSplit = year === currentInfo.year && split === currentInfo.split;

  // The current split is always labelled as "In progress"
  // in the Hall of Fame, regardless of data.
  if (isCurrentSplit) {
    return { year, split, status: "in-progress" };
  }

  const csvPath = buildCsvPath(year, split);

  try {
    const response = await fetch(csvPath, { cache: "no-cache" });

    if (!response.ok) {
      // CSV not found: call it "Off split"
      console.warn("HoF: CSV not found for", year, "Split", split, csvPath);
      return { year, split, status: "off-split" };
    }

    const text = await response.text();
    const records = parseCsv(text);

    if (!records.length) {
      return { year, split, status: "off-split" };
    }

    const totalsMap = tallyScores(records);
    const ranked = createRankedArray(totalsMap);

    if (!ranked.length) {
      return { year, split, status: "off-split" };
    }

    // Completed split: show the top 1–2 players.
    return {
      year,
      split,
      status: "completed",
      players: ranked.slice(0, 2),
    };
  } catch (err) {
    console.error(`HoF: error loading ${year} Split ${split}:`, err);
    return { year, split, status: "off-split" };
  }
}

/**
 * renderHallOfFameEntry(summary)
 * ------------------------------
 * Creates the HTML structure for one split in the Hall of Fame.
 */
function renderHallOfFameEntry(summary) {
  const wrapper = document.createElement("div");
  wrapper.className = "scoreboard-hof-entry";

  const title = document.createElement("h3");
  title.className = "scoreboard-hof-title";
  title.textContent = `${summary.year} · Split ${summary.split}`;
  wrapper.appendChild(title);

  const body = document.createElement("div");
  body.className = "scoreboard-hof-body";

  if (summary.status === "completed" && summary.players?.length) {
    // Small table of the top 1–2 players.
    const table = document.createElement("table");
    table.className = "scoreboard-table scoreboard-table--mini";

    const tbody = document.createElement("tbody");

    summary.players.forEach((p) => {
      const tr = document.createElement("tr");

      const rankTd = document.createElement("td");
      rankTd.className = "scoreboard-rank-cell";
      rankTd.textContent = `Rank ${p.rank}`;

      const nameTd = document.createElement("td");
      nameTd.className = "scoreboard-name-cell";
      nameTd.textContent = getDisplayName(p.player); // <-- nicknames here too

      const scoreTd = document.createElement("td");
      scoreTd.className = "scoreboard-score-cell";
      scoreTd.textContent = p.total.toString();

      tr.append(rankTd, nameTd, scoreTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    body.appendChild(table);
  } else {
    // "In progress" or "Off split" message.
    const p = document.createElement("p");
    p.className = "scoreboard-hof-status";
    p.textContent = summary.status === "in-progress" ? "In progress" : "Off split";
    body.appendChild(p);
  }

  wrapper.appendChild(body);
  return wrapper;
}

/* -------------------------------------------------
   6. CSV PARSING & SCORE TALLYING
-------------------------------------------------- */

/**
 * parseCsv(text)
 * --------------
 * Converts CSV text into an array of { player, score } objects.
 *
 * Your CSV format:
 *   PlayerID,Score,GameName,Date,Notes
 *   Alex E.,2.0,Clue,07/20/2024,
 *
 * We only care about the first two columns:
 *   PlayerID and Score.
 *
 * To keep things simple and robust (even when Notes
 * contain commas), we:
 *   - Skip the header row (first line)
 *   - For each data row, find the first two commas,
 *     and treat that as:
 *       [PlayerID],[Score],(everything else ignored)
 */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const records = [];

  // Skip index 0 (the header: "PlayerID,Score,...")
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Find the first comma
    const firstComma = line.indexOf(",");
    if (firstComma === -1) continue;

    // Find the second comma after that
    const secondComma = line.indexOf(",", firstComma + 1);
    if (secondComma === -1) continue;

    const playerPart = line.slice(0, firstComma).trim();
    const scorePart = line.slice(firstComma + 1, secondComma).trim();

    if (!playerPart) continue;

    // Extract a number from the score field (e.g. "2.0" or "2")
    const match = scorePart.match(/-?\d+(\.\d+)?/);
    if (!match) continue;

    const score = Number(match[0]);
    if (Number.isNaN(score)) continue;

    records.push({
      player: playerPart,
      score,
    });
  }

  return records;
}

/**
 * tallyScores(records)
 * --------------------
 * Takes an array of { player, score } and returns a Map
 * from player name → total score for that split.
 */
function tallyScores(records) {
  const totals = new Map();

  records.forEach(({ player, score }) => {
    const previous = totals.get(player) ?? 0;
    totals.set(player, previous + score);
  });

  return totals;
}

/**
 * createRankedArray(totalsMap)
 * ----------------------------
 * Converts the Map(player → total) into a sorted array:
 *   [{ rank, player, total }, ...]
 *
 * Sort order:
 *   - Highest score first
 *   - If scores tie, alphabetical by player name
 */
function createRankedArray(totalsMap) {
  const entries = Array.from(totalsMap.entries()).map(([player, total]) => ({
    player,
    total,
  }));

  entries.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total; // higher scores first
    }
    return a.player.localeCompare(b.player); // tie-breaker: name
  });

  return entries.map((entry, index) => ({
    rank: index + 1,
    player: entry.player,
    total: entry.total,
  }));
}
