// SHA-256 hex hash of your shared passphrase.
const SCHEDULE_PASSWORD_HASH = "8a8477fb99c9b7dba1ab060e3abda316db363538b3b8f2550ca605c2650dbbc2";

document.addEventListener("DOMContentLoaded", () => {
  // Dynamic copyright
  const copyrightEl = document.getElementById("copyright");
  if (copyrightEl) {
    const year = new Date().getFullYear();
    copyrightEl.textContent = `© ${year} Alexander Escobar. All Rights Reserved`;
  }

  const nav = document.querySelector(".main-nav");
  const navToggle = document.querySelector(".nav-toggle");
  const navOverlay = document.querySelector(".nav-overlay");
  const navLinks = document.querySelectorAll(".nav-links a");

  function openNav() {
    if (!nav) return;
    nav.classList.add("nav-open");
    document.body.classList.add("nav-menu-open");
  }

  function closeNav() {
    if (!nav) return;
    nav.classList.remove("nav-open");
    document.body.classList.remove("nav-menu-open");
  }

  function toggleNav() {
    if (!nav) return;
    if (nav.classList.contains("nav-open")) {
      closeNav();
    } else {
      openNav();
    }
  }

  if (nav && navToggle) {
    navToggle.addEventListener("click", toggleNav);
  }

  if (navOverlay) {
    navOverlay.addEventListener("click", closeNav);
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", closeNav);
  });
});

// Schedule password protection
const schedulePage = document.querySelector(".page--schedule");
const scheduleForm = document.getElementById("schedule-form");
const schedulePasswordInput = document.getElementById("schedule-password");
const scheduleMessage = document.getElementById("schedule-message");

if (schedulePage && scheduleForm && schedulePasswordInput && scheduleMessage) {
  scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Clear previous message styles
    scheduleMessage.textContent = "";
    scheduleMessage.classList.remove("schedule-message--error", "schedule-message--success");

    const password = schedulePasswordInput.value.trim();
    if (!password) {
      scheduleMessage.textContent = "Please enter the passphrase.";
      scheduleMessage.classList.add("schedule-message--error");
      return;
    }

    try {
      const hashHex = await hashStringSHA256(password);

      if (SCHEDULE_PASSWORD_HASH && hashHex.toLowerCase() === SCHEDULE_PASSWORD_HASH.toLowerCase()) {
        // Correct password
        schedulePage.classList.add("schedule-unlocked");
        scheduleMessage.textContent = "Welcome to the Pantheon schedule.";
        scheduleMessage.classList.add("schedule-message--success");

        // Optionally clear the input for neatness
        schedulePasswordInput.value = "";
      } else {
        // Incorrect password
        scheduleMessage.textContent = "That key does not match our records.";
        scheduleMessage.classList.add("schedule-message--error");
      }
    } catch (err) {
      console.error("Error hashing password:", err);
      scheduleMessage.textContent = "An error occurred while verifying the key.";
      scheduleMessage.classList.add("schedule-message--error");
    }
  });
}

// Helper: hash a string using SHA-256 and return a hex string
async function hashStringSHA256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

// Automatically fill in the next Saturday in the format "Saturday - dd/mm"
const scheduleDayEl = document.getElementById("schedule-day");

if (scheduleDayEl) {
  const nextSaturday = getNextSaturday();
  scheduleDayEl.textContent = formatSaturday(nextSaturday);
}

function getNextSaturday() {
  const today = new Date();

  // Saturday is day 6 (0=Sunday, 6=Saturday)
  const dayOfWeek = today.getDay();
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;

  // If today *is* Saturday, use today's date
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSaturday);

  return saturday;
}

function formatSaturday(dateObj) {
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  return `Saturday - ${month}/${day}`;
}
