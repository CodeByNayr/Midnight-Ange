const CORRECT_PIN_HASH = "186a0865337302ddf338bd02d1fd5069d6cea63abc53a5461c4632875400507d";
const CORRECT_PIN_SALT = "1dabb5f53511f0c6e6486a291bf990c0";
const PBKDF2_ITERATIONS = 600000;

function hexToBytes(hex){
  const arr = new Uint8Array(hex.length / 2);
  for(let i=0;i<arr.length;i++) arr[i] = parseInt(hex.substr(i*2,2),16);
  return arr;
}
function bytesToHex(bytes){
  return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function hashPin(pin, saltHex){
  const salt = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(derived));
}


const DIAMOND_ICON_INLINE = '<img src="Assets_resources_items/Diamond.png" alt="Diamond" style="height:1em;width:auto;vertical-align:-0.15em;display:inline-block;">';

/* ---------------- stars (ambient) ---------------- */
(function makeStars(){
  const field = document.getElementById('stars');
  const count = 70;
  for(let i=0;i<count;i++){
    const s = document.createElement('span');
    if(Math.random() < 0.2) s.className = 'star-big';
    s.style.left = Math.random()*100 + '%';
    s.style.top = Math.random()*70 + '%';
    s.style.animationDelay = (Math.random()*4) + 's';
    s.style.animationDuration = (2.2 + Math.random()*3.4) + 's';
    field.appendChild(s);
  }
})();

/* ---------------- PIN GATE ---------------- */
const pinInputs = Array.from(document.querySelectorAll('.pin-digit'));
const pinError = document.getElementById('pinError');
const pinSubmit = document.getElementById('pinSubmit');
const pinScreen = document.getElementById('pinScreen');
const app = document.getElementById('app');

pinInputs.forEach((input, i) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^0-9]/g, '').slice(0,1);
    if(input.value && pinInputs[i+1]) pinInputs[i+1].focus();
  });
  input.addEventListener('keydown', (e) => {
    if(e.key === 'Backspace' && !input.value && pinInputs[i-1]){
      pinInputs[i-1].focus();
    }
    if(e.key === 'Enter') tryUnlock();
  });
});

pinSubmit.addEventListener('click', tryUnlock);

/* ---- lockout after 3 wrong attempts: 30 min cooldown ---- */
const MAX_PIN_ATTEMPTS = 3;
const PIN_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
let pinCooldownInterval = null;

function getPinAttempts(){ return Number(localStorage.getItem('pinAttempts') || 0); }
function setPinAttempts(n){ localStorage.setItem('pinAttempts', String(n)); }
function getPinLockUntil(){ return Number(localStorage.getItem('pinLockUntil') || 0); }
function setPinLockUntil(ts){ localStorage.setItem('pinLockUntil', String(ts)); }
function clearPinLock(){
  localStorage.removeItem('pinAttempts');
  localStorage.removeItem('pinLockUntil');
}

function formatCooldown(ms){
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function setPinInputsDisabled(disabled){
  pinInputs.forEach(i => { i.disabled = disabled; });
  pinSubmit.disabled = disabled;
}

function startPinCooldownDisplay(){
  clearInterval(pinCooldownInterval);
  setPinInputsDisabled(true);
  const tick = () => {
    const remaining = getPinLockUntil() - Date.now();
    if(remaining <= 0){
      clearInterval(pinCooldownInterval);
      clearPinLock();
      setPinInputsDisabled(false);
      pinError.classList.remove('show');
      pinInputs.forEach(i => i.value = '');
      pinInputs[0].focus();
      return;
    }
    pinError.textContent = `Sobra na sa mali attempts. Try ulit after ${formatCooldown(remaining)}`;
    pinError.classList.add('show');
  };
  tick();
  pinCooldownInterval = setInterval(tick, 1000);
}

/* checks lock state; returns true if currently locked (and updates UI) */
function isPinLocked(){
  const lockUntil = getPinLockUntil();
  if(lockUntil && Date.now() < lockUntil){
    startPinCooldownDisplay();
    return true;
  }
  if(lockUntil){
    // lock expired since last check
    clearPinLock();
    setPinInputsDisabled(false);
  }
  return false;
}

// re-apply lock state on load (in case of refresh mid-cooldown)
isPinLocked();

async function tryUnlock(){
  if(isPinLocked()) return;

  const entered = pinInputs.map(i => i.value).join('');
  if(entered.length < 6){
    flashError("6 digits nganiii");
    return;
  }
  const enteredHash = await hashPin(entered, CORRECT_PIN_SALT);
  if(enteredHash === CORRECT_PIN_HASH){
    clearPinLock();
    unlock();
  } else {
    const attempts = getPinAttempts() + 1;
    setPinAttempts(attempts);
    pinInputs.forEach(i => { i.classList.add('shake'); });

    if(attempts >= MAX_PIN_ATTEMPTS){
      setPinLockUntil(Date.now() + PIN_COOLDOWN_MS);
      setTimeout(() => {
        pinInputs.forEach(i => { i.classList.remove('shake'); i.value=''; });
      }, 400);
      startPinCooldownDisplay();
    } else {
      const triesLeft = MAX_PIN_ATTEMPTS - attempts;
      flashError(`Mali yunnn. try mo ulit lablab hehehe (${triesLeft} try${triesLeft === 1 ? '' : 's'} na lang)`);
      setTimeout(() => {
        pinInputs.forEach(i => { i.classList.remove('shake'); i.value=''; });
        pinInputs[0].focus();
      }, 400);
    }
  }
}

function flashError(msg){
  pinError.textContent = msg;
  pinError.classList.add('show');
  setTimeout(() => pinError.classList.remove('show'), 2200);
}

function unlock(){
  pinScreen.style.transition = 'opacity .5s ease';
  pinScreen.style.opacity = '0';
  setTimeout(() => {
    pinScreen.classList.add('hidden');
    app.classList.remove('hidden');
    document.body.setAttribute('data-mood','0');
    startMusic();
  }, 480);
}

/* ---------------- SCENE NAV ---------------- */
const scenes = Array.from(document.querySelectorAll('.scene'));
const navDots = Array.from(document.querySelectorAll('.nav-dot'));
const scenesContainer = document.getElementById('scenes');
const sceneNavHome = document.getElementById('sceneNavHome');
const homeToggle = document.getElementById('homeToggle');
const GATCHA_SCENE_INDEX = 5;
const HEARTS_SCENE_INDEX = 2;
let activeSceneIndex = -1; // -1 = on the grid menu, no scene open yet

function goToScene(index){
  const wasInGatcha = activeSceneIndex === GATCHA_SCENE_INDEX;
  const leavingGatcha = wasInGatcha && index !== GATCHA_SCENE_INDEX;
  const wasInHearts = activeSceneIndex === HEARTS_SCENE_INDEX;
  const leavingHearts = wasInHearts && index !== HEARTS_SCENE_INDEX;

  activeSceneIndex = index;
  scenes.forEach(s => s.classList.toggle('active', Number(s.dataset.scene) === index));
  navDots.forEach(d => d.classList.toggle('active', Number(d.dataset.goto) === index));
  document.body.setAttribute('data-mood', String(index));

  // leaving the grid menu to open a scene
  sceneNavHome.classList.add('hidden');
  scenesContainer.classList.remove('hidden');
  homeToggle.classList.remove('hidden');

  if(index === 3) startFactsClock();
  if(index === 4) loadWallPosts();

  if(leavingGatcha){ resetGatchaProgress(); }
  if(leavingHearts){ resetHeartsGame(); }
}

function goHome(){
  const wasInGatcha = activeSceneIndex === GATCHA_SCENE_INDEX;
  activeSceneIndex = -1;
  scenes.forEach(s => s.classList.remove('active'));
  navDots.forEach(d => d.classList.remove('active'));
  document.body.setAttribute('data-mood', '0');

  scenesContainer.classList.add('hidden');
  sceneNavHome.classList.remove('hidden');
  homeToggle.classList.add('hidden');

  if(wasInGatcha){ resetGatchaProgress(); }
  // every tap of the home button clears any in-progress "Saluhin Mo Nga Puso Ko?" round
  resetHeartsGame();
}

navDots.forEach(d => {
  d.addEventListener('click', () => goToScene(Number(d.dataset.goto)));
});
homeToggle.addEventListener('click', goHome);

/* ============================================================
   SCENE 1 — "open when" envelopes
   ============================================================ */
const envelopeData = [
  {
    label: "open mo kung malungkot lablab ko",
    icon: "images/cat_sad.gif",
    eyebrow: "for the sad days",
    body: "Alam kong... malungkot ka ngayon, pero okay lang yan. Nandito naman ako palagi para sa'yo, ganun talaga ang buhay, minsan malinaw, minsan naman kumplikado. Minsan pa-angat minsan pa bagsak. Pero ganun talaga ang buhay, ang mahalaga nag mamahalan tayo at nandito tayo lumalaban para sa isat-isa. 💜"
  },
  {
    label: "open mo nga to kung miss mo'ko",
    icon: "images/cat_miss.gif",
    eyebrow: "for the missing-you moments",
    body: "I miss you lablab ko 🥰😘😘 mag kikita rin tayo sa susunod, kaya stay patient ka lang dyan."
  },
  {
    label: "open mo to kapag hindi ka makatulog",
    icon: "images/cat_cant_sleep.gif",
    eyebrow: "for the sleepless nights",
    body: "I-relax mo lang ang iyong isip, maintain mo lang na relax din paligid mo, then isipin mo katabi mo akong natutulog, paniwalain mo rin isip mo na tulog kana talaga at kailangan mo nalang ipag patuloy, sleep well lablab ko, mwuuuuuahhhhhhhhh"
  },
  {
    label: "open mo to kung galit kana sakin",
    icon: "images/cat_angry.gif",
    eyebrow: "for when i messed up",
    body: "Sorry na mahal ko kung na uubos ko nanaman pasensya mo, pasensya na 🙇‍♂️🙇‍♂️ mahal na mahal kita Ange 🫶"
  },
  {
    label: "open mo to kung gusto mo matawa",
    icon: "images/cat_laugh.gif",
    eyebrow: "for when you need to laugh",
    body: "<span class=\"envelope-note-small\">Notes: After mo i exit may mga nakakatawa pa ulit HAHHAHAHAHAH ata</span>",
    images: ["images/funny1.jpg", "images/funny2.jpeg", "images/funny3.jpeg", "images/funny4.jpeg", "images/funny5.JPG", "images/funny6.jpeg", "images/funny7.jpg", "images/funny8.jpg", "images/funny9.jpg"]
  },
];

const envelopeField = document.getElementById('envelopeField');
envelopeData.forEach((item, idx) => {
  const el = document.createElement('button');
  el.className = 'envelope';
  const iconHTML = /\.(gif|png|jpe?g|webp)$/i.test(item.icon)
    ? `<img class="envelope-icon" src="${item.icon}" alt="">`
    : `<span class="envelope-icon">${item.icon}</span>`;
  el.innerHTML = `${iconHTML}<span class="envelope-label">${item.label}</span>`;
  el.addEventListener('click', () => {
    el.classList.add('wiggle');
    setTimeout(() => el.classList.remove('wiggle'), 400);
    openEnvelopeModal(item);
  });
  envelopeField.appendChild(el);
});

const envelopeModal = document.getElementById('envelopeModal');
const envelopeModalEyebrow = document.getElementById('envelopeModalEyebrow');
const envelopeModalBody = document.getElementById('envelopeModalBody');
document.getElementById('envelopeModalClose').addEventListener('click', () => envelopeModal.classList.add('hidden'));
envelopeModal.addEventListener('click', (e) => { if(e.target === envelopeModal) envelopeModal.classList.add('hidden'); });

function openEnvelopeModal(item){
  envelopeModalEyebrow.textContent = item.eyebrow;
  let html = '';
  if(item.images && item.images.length){
    const pick = pickNextEnvelopeImage(item);
    html += `<img class="modal-photo" src="${pick}" alt="a funny memory">`;
  }
  html += item.body;
  envelopeModalBody.innerHTML = html;
  envelopeModal.classList.remove('hidden');
}

/* picks the next image for an envelope from a shuffled "bag" so every
   image is shown once before any repeats — and avoids showing the same
   image twice in a row when a bag runs out and reshuffles. */
function pickNextEnvelopeImage(item){
  if(!item._imageBag || item._imageBag.length === 0){
    let bag = shuffle([...item.images]);
    if(item._lastShownImage && bag.length > 1 && bag[0] === item._lastShownImage){
      const swapWith = 1 + Math.floor(Math.random() * (bag.length - 1));
      [bag[0], bag[swapWith]] = [bag[swapWith], bag[0]];
    }
    item._imageBag = bag;
  }
  const pick = item._imageBag.shift();
  item._lastShownImage = pick;
  return pick;
}

/* ============================================================
   SCENE 2 — quiz: "how well do you know me — nayr edition"
   ============================================================ */
const quizData = [
  {
    q: "ahmm... Favorite toy ko?",
    options: ["Beyblade", "Pokemon Cards", "Yu-Gi-Oh Cards", "Fidget Spinner"],
    correct: 0
  },
  {
    q: "Anong favorite food ko?",
    options: ["Adobo", "Sinigang", "Kare-kare", "Nilaga", "Tinola"],
    correct: 2
  },
  {
    q: "Anong favorite color ko?",
    options: ["Blue", "Pink", "Black", "Purple", "Gray"],
    correct: 3
  },
  {
    q: "Mga favorite music ko, kung alam mo?",
    options: [
      "Your Universe / About You / Pag-ibig ay Kanibalismo",
      "Lovers / Enchanted / You Belong with Me",
      "The Only Exception / Still Into You",
      "Residuals / OTW / Mean It"
    ],
    correct: 2
  },
  {
    q: "Sigi nga, anong nickname ko?",
    options: ["Tenggai", "Tangei", "Tengei", "Tengaii", "Tengai"],
    correct: 4
  }
];

const CORRECT_FEEDBACK_LINES = [
  "Yes, tama yan HAHAHAHA",
  "Tamaaaa go lablab",
  "Correct ka dyan",
  "Niceee, galing"
];
const FEEDBACK_DISPLAY_MS = 1200;

function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let quizIndex = 0;
let quizScore = 0;
let quizOrder = shuffle(quizData.map((_, i) => i)); // randomized order of questions
const quizWrap = document.getElementById('quizWrap');

function renderQuiz(){
  if(quizIndex >= quizData.length){
    quizWrap.innerHTML = `
      <div class="quiz-card quiz-result">
        <p class="big">${quizScore} / ${quizData.length}</p>
        <p>${quizResultLine(quizScore)}</p>
        <button class="quiz-next" id="quizRestart">Play Again?</button>
      </div>`;
    document.getElementById('quizRestart').addEventListener('click', () => {
      quizIndex = 0; quizScore = 0; quizOrder = shuffle(quizData.map((_, i) => i)); renderQuiz();
    });
    return;
  }
  const item = quizData[quizOrder[quizIndex]];
  const order = shuffle(item.options.map((_, i) => i));
  quizWrap.innerHTML = `
    <p class="quiz-progress">Question ${quizIndex+1} of ${quizData.length}</p>
    <div class="quiz-card">
      <p class="quiz-question">${item.q}</p>
      <div class="quiz-options">
        ${order.map(i => `<button class="quiz-option" data-i="${i}">${item.options[i]}</button>`).join('')}
      </div>
      <p class="quiz-feedback" id="quizFeedback"></p>
    </div>`;

  const optionEls = Array.from(quizWrap.querySelectorAll('.quiz-option'));
  optionEls.forEach(btn => {
    btn.addEventListener('click', () => {
      optionEls.forEach(b => b.disabled = true);
      const chosen = Number(btn.dataset.i);
      const feedback = document.getElementById('quizFeedback');
      if(chosen === item.correct){
        btn.classList.add('correct');
        quizScore++;
        feedback.textContent = CORRECT_FEEDBACK_LINES[Math.floor(Math.random() * CORRECT_FEEDBACK_LINES.length)];
        spawnMiniHeart(btn);
        setTimeout(() => {
          if(feedback.isConnected) feedback.textContent = '';
        }, FEEDBACK_DISPLAY_MS);
      } else {
        btn.classList.add('wrong');
        const correctBtn = optionEls.find(b => Number(b.dataset.i) === item.correct);
        if(correctBtn) correctBtn.classList.add('correct');
        feedback.textContent = "hmmm... mali HAHAHHA";
      }
      const nextBtn = document.createElement('button');
      nextBtn.className = 'quiz-next';
      nextBtn.textContent = (quizIndex === quizData.length - 1) ? 'see my score' : 'next question';
      nextBtn.addEventListener('click', () => { quizIndex++; renderQuiz(); });
      quizWrap.querySelector('.quiz-card').appendChild(nextBtn);
    });
  });
}

function quizResultLine(score){
  const total = quizData.length;
  if(score === total) return "Wow Perfect scores, galing galing ng lablab ko";
  if(score >= total - 1) return "Ang galing parin ng lablab ko, niceee.";
  if(score >= total/2) return "hmm, hindi mo na yata ako kilala 🫩";
  return "Lahh seryoso yahh? HAHAHHAHA 😂";
}

function spawnMiniHeart(anchor){
  const rect = anchor.getBoundingClientRect();
  const heart = document.createElement('div');
  heart.textContent = '💜';
  heart.style.position = 'fixed';
  heart.style.left = rect.left + rect.width/2 + 'px';
  heart.style.top = rect.top + 'px';
  heart.style.color = 'var(--rose)';
  heart.style.fontSize = '20px';
  heart.style.pointerEvents = 'none';
  heart.style.zIndex = 50;
  heart.style.transition = 'transform 1s ease, opacity 1s ease';
  document.body.appendChild(heart);
  requestAnimationFrame(() => {
    heart.style.transform = 'translateY(-60px) scale(1.6)';
    heart.style.opacity = '0';
  });
  setTimeout(() => heart.remove(), 1000);
}

renderQuiz();

/* ============================================================
   SCENE 3 — catch my hearts
   ============================================================ */
const heartsStage = document.getElementById('heartsStage');
const heartsScoreEl = document.getElementById('heartsScore');
const heartsTimeEl = document.getElementById('heartsTime');
const heartsStart = document.getElementById('heartsStart');
const heartsResult = document.getElementById('heartsResult');
const heartsSub = document.getElementById('heartsSub');

const HEART_ICON_HTML = '<img class="inline-emoji-icon" src="Assets_resources_items/Purple_Heart.png" alt="heart">';
const ROCK_ICON_HTML = '<img class="inline-emoji-icon" src="Assets_resources_items/Falling_Rocks.png" alt="rock">';

const GAME_DURATION = 25; // seconds
const HEARTS_WIN_SCORE = 15; // hearts to catch to "win"
let heartsScore = 0;
let heartsTimeLeft = GAME_DURATION;
let heartsSpawnTimer = null;
let heartsCountdown = null;
let heartsRunning = false;

const heartsGoalEl = document.getElementById('heartsGoal');
if(heartsGoalEl) heartsGoalEl.textContent = String(HEARTS_WIN_SCORE);

heartsStart.addEventListener('click', startHeartsGame);

function startHeartsGame(){
  if(heartsRunning) return;
  heartsRunning = true;
  heartsScore = 0;
  heartsTimeLeft = GAME_DURATION;
  heartsScoreEl.textContent = '0';
  heartsTimeEl.textContent = String(GAME_DURATION);
  heartsResult.classList.add('hidden');
  heartsResult.innerHTML = '';
  heartsStage.innerHTML = '';
  heartsStart.classList.add('hidden');
  heartsSub.innerHTML = "Tap the hearts before they fall, iwasan ang mga " + ROCK_ICON_HTML + " rocks!";

  heartsSpawnTimer = setInterval(spawnHeart, 550);
  heartsCountdown = setInterval(() => {
    heartsTimeLeft--;
    heartsTimeEl.textContent = String(heartsTimeLeft);
    if(heartsTimeLeft <= 0) endHeartsGame();
  }, 1000);
}

const FALLING_ITEM_SIZE = 30; // uniform size for every falling heart (and rock)
const ROCK_CHANCE = 0.3; // 30% falling rocks, 70% falling hearts

function spawnHeart(){
  if(!heartsRunning) return;
  const isRock = Math.random() < ROCK_CHANCE;
  const item = document.createElement('button');
  item.className = isRock ? 'falling-heart falling-rock' : 'falling-heart';
  item.innerHTML = isRock
    ? '<img src="Assets_resources_items/Falling_Rocks.png" alt="rock">'
    : '<img src="Assets_resources_items/Purple_Heart.png" alt="heart">';
  const stageWidth = heartsStage.clientWidth;
  item.style.left = Math.random() * (stageWidth - 40) + 'px';
  item.style.width = FALLING_ITEM_SIZE + 'px';
  item.style.height = FALLING_ITEM_SIZE + 'px';
  const duration = 3 + Math.random()*2;
  item.style.animationDuration = duration + 's';
  item.addEventListener('click', () => {
    if(item.classList.contains('popped')) return;
    item.classList.add('popped');
    if(isRock){
      heartsScore = Math.max(0, heartsScore - 2);
    } else {
      heartsScore++;
    }
    heartsScoreEl.textContent = String(heartsScore);
    setTimeout(() => item.remove(), 300);
  });
  item.addEventListener('animationend', () => {
    if(item.parentNode && !item.classList.contains('popped')) item.remove();
  });
  heartsStage.appendChild(item);
}

function endHeartsGame(){
  heartsRunning = false;
  clearInterval(heartsSpawnTimer);
  clearInterval(heartsCountdown);
  heartsStage.querySelectorAll('.falling-heart').forEach(h => h.remove());
  heartsResult.classList.remove('hidden');

  const won = heartsScore >= HEARTS_WIN_SCORE;
  heartsSub.innerHTML = won ? "Nanalo ka! " + HEART_ICON_HTML : "Round over";
  heartsResult.innerHTML = won
    ? `
    <p>you collected <b>${heartsScore}</b> hearts. Goal reached!</p>
    <p>and just like that, you've officially won mine too.</p>
    <p class="final-line">it was always yours. ${HEART_ICON_HTML}</p>
  `
    : `
    <p>you collected <b>${heartsScore}</b> of ${HEARTS_WIN_SCORE} hearts.</p>
    <p>so close... unfortunately, you still haven't collected mine.</p>
    <p class="final-line">it's already yours. ${HEART_ICON_HTML}</p>
  `;
  heartsStart.textContent = 'Laro ulit?';
  heartsStart.classList.remove('hidden');
}

function resetHeartsGame(){
  heartsRunning = false;
  clearInterval(heartsSpawnTimer);
  clearInterval(heartsCountdown);
  heartsSpawnTimer = null;
  heartsCountdown = null;
  heartsScore = 0;
  heartsTimeLeft = GAME_DURATION;
  heartsScoreEl.textContent = '0';
  heartsTimeEl.textContent = String(GAME_DURATION);
  heartsStage.innerHTML = '';
  heartsResult.classList.add('hidden');
  heartsResult.innerHTML = '';
  heartsStart.textContent = 'Start';
  heartsStart.classList.remove('hidden');
  heartsSub.innerHTML = "Tap the hearts before they fall, iwasan ang mga " + ROCK_ICON_HTML + " rocks, -2 pts!";
}

/* ============================================================
   SCENE 4 — us, in numbers (live counter since Feb 17 2025)
   ============================================================ */
const START_DATE = new Date(2025, 1, 17, 0, 0, 0); // Feb 17 2025, local time
let factsClockStarted = false;

function startFactsClock(){
  if(factsClockStarted) return;
  factsClockStarted = true;
  updateFacts();
  setInterval(updateFacts, 1000);
}

function updateFacts(){
  const now = new Date();
  let diffMs = now - START_DATE;
  if(diffMs < 0) diffMs = 0;

  const totalSeconds = Math.floor(diffMs / 1000);

  // Calendar-accurate years/months, then remainder in weeks/days/hours.
  let years = now.getFullYear() - START_DATE.getFullYear();
  let months = now.getMonth() - START_DATE.getMonth();
  let days = now.getDate() - START_DATE.getDate();
  let hours = now.getHours() - START_DATE.getHours();

  if(hours < 0){ hours += 24; days -= 1; }
  if(days < 0){
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
    months -= 1;
  }
  if(months < 0){ months += 12; years -= 1; }

  const weeks = Math.floor(days / 7);
  const remDays = days % 7;

  document.getElementById('fYears').textContent = years;
  document.getElementById('fMonths').textContent = months;
  document.getElementById('fWeeks').textContent = weeks;
  document.getElementById('fDays').textContent = remDays;
  document.getElementById('fHours').textContent = hours;
  document.getElementById('fSeconds').textContent = totalSeconds.toLocaleString('en-US');
}

/* ============================================================
   SCENE 6 — TENGAI GATCHA DRAW
   ============================================================ */
const DIAMOND_ICON = "Assets_resources_items/Diamond.png";

const gatchaDrawData = [
  { name: "Donut Matcha",       powder: 30,   weight: 8.84,  icon: "Assets_resources_items/Donut Matcha.png" },
  { name: "Coffee Matcha",      powder: 20,   weight: 26.53, icon: "Assets_resources_items/Coffee Matcha.png" },
  { name: "Tengai with Flower", powder: 60,   weight: 4.42,  icon: "Assets_resources_items/Tengai with Flower.png", rare: true },
  { name: "Matcha in Cup",      powder: 10,   weight: 57.49, icon: "Assets_resources_items/Matcha in Cup.png" },
  { name: "Distorted Nash",     powder: -50, weight: 0.88,  icon: "Assets_resources_items/Distorted Nash.png", trap: true },
  { name: "Rich Tengai",        powder: 1000, weight: 0.90,  icon: "Assets_resources_items/Rich Tengai.png", rare: true },
  { name: "Matcha Key",         powder: 0,    weight: 1,  icon: "Assets_resources_items/Matcha Key.png", key: true, rare: true },
];
// weights above sum to exactly 100, and are used directly as draw
// percentages (weight/GATCHA_WEIGHT_TOTAL = probability):
//   Donut Matcha 8.84% · Coffee Matcha 26.53% · Tengai with Flower 4.42%
//   Matcha in Cup 57.49% · Distorted Nash 0.88% (trap, -100 powder)
//   Rich Tengai 0.99% (super rare, +1000 Matcha Powder)
//   Matcha Key 0.85% (super rare, grants 1 Matcha Key — the only way to
//   unlock the Ultra Rare Cat Tengai in the Draw Exchange below, which
//   also now costs 4,000 Matcha Powder on top of the key — nerfed)
const GATCHA_WEIGHT_TOTAL = gatchaDrawData.reduce((s, r) => s + r.weight, 0);

const gatchaExchangeData = [
  { name: "Hoodie Tengai",   cost: 1000,  icon: "Assets_resources_items/Draw Exchange Reward Icon/Hoodie Tengai.jpg" },
  { name: "Red Hair Tengai", cost: 1000, icon: "Assets_resources_items/Draw Exchange Reward Icon/Red Hair Tengai.jpeg" },
  { name: "Smiley Tengai",   cost: 1000,  icon: "Assets_resources_items/Draw Exchange Reward Icon/Smiley Tengai.jpeg" },
  { name: "Sunny Tengai",    cost: 2000, icon: "Assets_resources_items/Draw Exchange Reward Icon/Sunny Tengai.png" },
  { name: "Dipende kung 3 yan Tengai", cost: 2400,  icon: "Assets_resources_items/Draw Exchange Reward Icon/Dipende kung 3 yan Tengai.jpeg" },
  { name: "Super Emo Tengai",          cost: 2400, icon: "Assets_resources_items/Draw Exchange Reward Icon/Super Emo Tengai.JPG" },
  { name: "Ultra Rare Tengai", requiresKey: true, keysNeeded: 3, cost: 5000, ultra: true, icon: "Assets_resources_items/Ultra Rare Cat Tengai.jpg" },
  { name: "Galaxy Nova Tengai", requiresKey: true, keysNeeded: 10, cost: 15000, ultra: true, galaxy: true, icon: "Assets_resources_items/Galaxy Tengai.jpg" },
];

const GATCHA_1X_COST = 10;
const GATCHA_10X_COST = 100;

let gatchaState = { diamonds: 0, matchaPowder: 0, matchaKeys: 0, exchanged: {} };

const gatchaEntry = document.getElementById('gatchaEntry');
const gatchaEntryError = document.getElementById('gatchaEntryError');
const gatchaDiamondInput = document.getElementById('gatchaDiamondInput');
const gatchaEnterBtn = document.getElementById('gatchaEnterBtn');
const gatchaPanel = document.getElementById('gatchaPanel');
const gatchaDiamondBalanceEl = document.getElementById('gatchaDiamondBalance');
const gatchaMatchaBalanceEl = document.getElementById('gatchaMatchaBalance');
const gatchaKeyBalanceEl = document.getElementById('gatchaKeyBalance');
const gatchaDraw1xBtn = document.getElementById('gatchaDraw1x');
const gatchaDraw10xBtn = document.getElementById('gatchaDraw10x');
const gatchaMsgEl = document.getElementById('gatchaMsg');
const gatchaResultsEl = document.getElementById('gatchaResults');
const gatchaResultsTotalEl = document.getElementById('gatchaResultsTotal');
const gatchaResultsTotalValueEl = document.getElementById('gatchaResultsTotalValue');
const gatchaExchangeGrid = document.getElementById('gatchaExchangeGrid');
const drawSoundAudio = document.getElementById('drawSoundAudio');
const gatchaRechargeInput = document.getElementById('gatchaRechargeInput');
const gatchaRechargeBtn = document.getElementById('gatchaRechargeBtn');
const gatchaRechargeMsg = document.getElementById('gatchaRechargeMsg');
const gatchaExchangeModal = document.getElementById('gatchaExchangeModal');
const gatchaExchangeModalClose = document.getElementById('gatchaExchangeModalClose');
const gatchaExchangeModalIcon = document.getElementById('gatchaExchangeModalIcon');
const gatchaExchangeModalName = document.getElementById('gatchaExchangeModalName');
const exchangeVictoryAudio = document.getElementById('exchangeVictoryAudio');
const exchangeWowAudio = document.getElementById('exchangeWowAudio');

/* randomly plays either the Victory or WowCongratulations sound
   whenever a Draw Exchange reward is claimed */
function playExchangeSound(){
  const pick = Math.random() < 0.5 ? exchangeVictoryAudio : exchangeWowAudio;
  if(!pick) return;
  pick.currentTime = 0;
  pick.play().catch(() => {});
}

gatchaEnterBtn.addEventListener('click', startGatcha);
gatchaDiamondInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') startGatcha(); });

function startGatcha(){
  const val = Math.floor(Number(gatchaDiamondInput.value));
  if(!val || val <= 0){
    gatchaEntryError.classList.remove('hidden');
    return;
  }
  gatchaEntryError.classList.add('hidden');
  gatchaState = { diamonds: val, matchaPowder: 0, matchaKeys: 0, exchanged: {} };
  gatchaEntry.classList.add('hidden');
  gatchaPanel.classList.remove('hidden');
  gatchaResultsEl.innerHTML = '';
  gatchaResultsEl.classList.add('hidden');
  gatchaResultsTotalEl.classList.add('hidden');
  gatchaResultsTotalValueEl.textContent = '0';
  setGatchaMsg('');
  updateGatchaHud();
  renderGatchaExchange();
}

function updateGatchaHud(){
  gatchaDiamondBalanceEl.textContent = String(gatchaState.diamonds);
  gatchaMatchaBalanceEl.textContent = String(gatchaState.matchaPowder);
  if(gatchaKeyBalanceEl) gatchaKeyBalanceEl.textContent = String(gatchaState.matchaKeys);
}

function setGatchaMsg(msg){
  gatchaMsgEl.innerHTML = msg || '';
}

function pickGatchaReward(){
  let r = Math.random() * GATCHA_WEIGHT_TOTAL;
  for(const item of gatchaDrawData){
    if(r < item.weight) return item;
    r -= item.weight;
  }
  return gatchaDrawData[gatchaDrawData.length - 1];
}

function playDrawSound(){
  if(!drawSoundAudio) return;
  drawSoundAudio.currentTime = 0;
  drawSoundAudio.play().catch(() => {});
}

gatchaDraw1xBtn.addEventListener('click', () => runGatchaDraw(1, GATCHA_1X_COST));
gatchaDraw10xBtn.addEventListener('click', () => runGatchaDraw(12, GATCHA_10X_COST));

function runGatchaDraw(times, cost){
  if(gatchaState.diamonds < cost){
    setGatchaMsg(`Hindi sapat ang Diamonds mo, kailangan ng ${cost} ${DIAMOND_ICON_INLINE}`);
    return;
  }
  gatchaState.diamonds -= cost;
  playDrawSound();

  const results = [];
  for(let i = 0; i < times; i++){
    const reward = pickGatchaReward();
    gatchaState.matchaPowder = Math.max(0, gatchaState.matchaPowder + reward.powder);
    if(reward.key) gatchaState.matchaKeys += 1;
    results.push(reward);
  }

  updateGatchaHud();
  setGatchaMsg(times === 1 ? 'Sige, isang draw!' : '12x draw, paldoo 😜');
  renderGatchaResults(results);
  renderGatchaResultsTotal(results, times);
  renderGatchaExchange();
}

function renderGatchaResults(results){
  gatchaResultsEl.classList.remove('hidden');
  gatchaResultsEl.innerHTML = results.map(r => `
    <div class="gatcha-result-card${r.rare ? ' rare' : ''}${r.trap ? ' trap' : ''}${r.key ? ' key' : ''}">
      <img class="gatcha-result-icon" src="${r.icon}" alt="${r.name}">
      <span class="gatcha-result-name">${r.name}</span>
      <span class="gatcha-result-powder">${r.key ? '🔑 +1 Key' : `${r.powder >= 0 ? '+' : ''}${r.powder} pts`}</span>
    </div>
  `).join('');
}

/* total Matcha Powder collected in the current batch of draws (1x or 12x) */
function renderGatchaResultsTotal(results, times){
  const total = results.reduce((s, r) => s + r.powder, 0);
  gatchaResultsTotalEl.classList.remove('hidden');
  gatchaResultsTotalValueEl.textContent = `${total >= 0 ? '+' : ''}${total}`;
  const label = gatchaResultsTotalEl.querySelector('.gatcha-results-total-label');
  label.innerHTML = times === 12
    ? 'Matcha Powder collected<span class="gatcha-results-total-sub">(this 12x draw):</span>'
    : 'Matcha Powder collected:';
}

/* recharge diamonds mid-game, without resetting matcha powder/exchange progress */
gatchaRechargeBtn.addEventListener('click', rechargeGatchaDiamonds);
gatchaRechargeInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') rechargeGatchaDiamonds(); });

function rechargeGatchaDiamonds(){
  const add = Math.floor(Number(gatchaRechargeInput.value));
  if(!add || add <= 0){
    showGatchaRechargeMsg('maglagay ka muna ng valid na number.');
    return;
  }
  gatchaState.diamonds += add;
  gatchaRechargeInput.value = '';
  updateGatchaHud();
  showGatchaRechargeMsg(`+${add} Diamonds added ${DIAMOND_ICON_INLINE}`);
}

function showGatchaRechargeMsg(msg){
  gatchaRechargeMsg.innerHTML = msg;
  gatchaRechargeMsg.classList.remove('hidden');
  clearTimeout(showGatchaRechargeMsg._t);
  showGatchaRechargeMsg._t = setTimeout(() => gatchaRechargeMsg.classList.add('hidden'), 2200);
}

function renderGatchaExchange(){
  gatchaExchangeGrid.innerHTML = gatchaExchangeData.map(item => {
    const owned = !!gatchaState.exchanged[item.name];
    const keysNeeded = item.keysNeeded || (item.requiresKey ? 1 : 0);
    const hasEnoughKeys = !item.requiresKey || gatchaState.matchaKeys >= keysNeeded;
    const hasEnoughPowder = !item.cost || gatchaState.matchaPowder >= item.cost;
    const canAfford = hasEnoughKeys && hasEnoughPowder;

    let costHtml = '';
    if(item.requiresKey){
      costHtml += `<span class="gatcha-exchange-cost"><img src="Assets_resources_items/Matcha Key.png" alt="">${keysNeeded} Matcha Key${keysNeeded > 1 ? 's' : ''}</span>`;
    }
    if(item.cost){
      costHtml += `<span class="gatcha-exchange-cost"><img src="Assets_resources_items/Matcha Powder.png" alt="">${item.cost.toLocaleString('en-US')}</span>`;
    }

    let btnLabel = 'exchange';
    if(owned) btnLabel = 'obtained';
    else if(!hasEnoughKeys) btnLabel = `need ${keysNeeded} Matcha Key${keysNeeded > 1 ? 's' : ''}`;
    else if(!hasEnoughPowder) btnLabel = 'need more Matcha Powder';

    return `
      <div class="gatcha-exchange-card${item.ultra ? ' ultra-rare' : ''}${item.galaxy ? ' galaxy-rare' : ''}">
        ${item.ultra ? `<span class="ultra-rare-badge${item.galaxy ? ' galaxy-badge' : ''}">✦ ${item.galaxy ? 'GALAXY' : 'ULTRA'} RARE ✦</span>` : ''}
        <img class="gatcha-exchange-icon" src="${item.icon}" alt="${item.name}">
        <span class="gatcha-exchange-name">${item.name}</span>
        <span class="gatcha-exchange-cost-group">${costHtml}</span>
        <button class="gatcha-exchange-btn" data-name="${item.name}" ${owned || !canAfford ? 'disabled' : ''}>
          ${btnLabel}
        </button>
      </div>
    `;
  }).join('');
}

gatchaExchangeGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.gatcha-exchange-btn');
  if(!btn || btn.disabled) return;
  const item = gatchaExchangeData.find(i => i.name === btn.dataset.name);
  if(!item) return;

  const keysNeeded = item.keysNeeded || (item.requiresKey ? 1 : 0);

  if(item.requiresKey && gatchaState.matchaKeys < keysNeeded){
    setGatchaMsg(`kailangan mo muna ng ${keysNeeded} Matcha Key${keysNeeded > 1 ? 's' : ''} para sa ${item.name} — subukan ulit sa draw.`);
    return;
  }
  if(item.cost && gatchaState.matchaPowder < item.cost){
    setGatchaMsg(`kulang pa ng ${(item.cost - gatchaState.matchaPowder).toLocaleString('en-US')} Matcha Powder para sa ${item.name}`);
    return;
  }

  if(item.requiresKey) gatchaState.matchaKeys -= keysNeeded;
  if(item.cost) gatchaState.matchaPowder -= item.cost;

  gatchaState.exchanged[item.name] = true;
  updateGatchaHud();
  renderGatchaExchange();
  playExchangeSound();
  openGatchaExchangeModal(item);
});

function openGatchaExchangeModal(item){
  gatchaExchangeModalIcon.src = item.icon;
  gatchaExchangeModalIcon.alt = item.name;
  gatchaExchangeModalName.textContent = item.name;
  gatchaExchangeModal.querySelector('.gatcha-congrats-card').classList.toggle('ultra-rare-modal', !!item.ultra && !item.galaxy);
  gatchaExchangeModal.querySelector('.gatcha-congrats-card').classList.toggle('galaxy-rare-modal', !!item.galaxy);
  gatchaExchangeModal.classList.remove('hidden');
}
gatchaExchangeModalClose.addEventListener('click', () => gatchaExchangeModal.classList.add('hidden'));
gatchaExchangeModal.addEventListener('click', (e) => { if(e.target === gatchaExchangeModal) gatchaExchangeModal.classList.add('hidden'); });

/* clicking to any other panel exits the gatcha game and resets progress */
function resetGatchaProgress(){
  gatchaState = { diamonds: 0, matchaPowder: 0, exchanged: {} };
  gatchaPanel.classList.add('hidden');
  gatchaEntry.classList.remove('hidden');
  gatchaDiamondInput.value = '';
  gatchaEntryError.classList.add('hidden');
  gatchaResultsEl.innerHTML = '';
  gatchaResultsEl.classList.add('hidden');
  gatchaResultsTotalEl.classList.add('hidden');
  gatchaResultsTotalValueEl.textContent = '0';
  setGatchaMsg('');
  gatchaRechargeInput.value = '';
  gatchaRechargeMsg.classList.add('hidden');
  gatchaExchangeModal.classList.add('hidden');
}

/* ============================================================
   BACKGROUND MUSIC
   ============================================================ */
/* randomized queue: any track (including Kisame) can play first now.
   Uses the same shuffled-bag trick as the envelope images — every track
   plays once before any repeats, and a track never repeats back-to-back
   when one bag empties and the next one is shuffled. */
const playlist = [
  { src: 'music/04-kisame.mp3', title: 'Kisame — rhodessa' },
  { src: 'music/01-palagi.mp3', title: 'PALAGI — TJ Monterde' },
  { src: 'music/02-711.mp3', title: '711 — TONEEJAY' },
  { src: 'music/03-gabi.mp3', title: 'Gabi — Mark Daniel' },
];
const bgAudio = document.getElementById('bgAudio');
const musicPlayPauseBtn = document.getElementById('musicPlayPauseBtn');
const musicPrevBtn = document.getElementById('musicPrevBtn');
const musicNextBtn = document.getElementById('musicNextBtn');
const musicSongName = document.getElementById('musicSongName');

// while true, bgAudio is looping the intro track on the pin screen.
// once unlocked, this flips to false and the queue advances through the bag.
let musicUnlocked = false;
let pinMusicStarted = false;

let musicBag = [];        // shuffled tracks still left to play in this set
let currentTrackSrc = null; // src of the track currently loaded / last played

// history of tracks played, plus a pointer into it — lets "prev" step
// backward through what's already played, and "next" step forward again
// through that same history before drawing a brand-new track from the bag.
let trackHistory = [];
let historyPos = -1;

function trackTitle(src){
  const found = playlist.find(t => t.src === src);
  return found ? found.title : '';
}

function updateSongNameDisplay(){
  if(musicSongName) musicSongName.textContent = currentTrackSrc ? trackTitle(currentTrackSrc) : '—';
}

function setPlayPauseIcon(isPaused){
  const pauseIcon = document.getElementById('musicPauseIcon');
  const playIcon = document.getElementById('musicPlayIcon');
  if(pauseIcon) pauseIcon.style.display = isPaused ? 'none' : 'block';
  if(playIcon) playIcon.style.display = isPaused ? 'block' : 'none';
}

/* draws the next track from the shuffled bag; refills + reshuffles once
   the bag runs out, avoiding an immediate repeat of the last track played */
function drawNextTrack(){
  if(musicBag.length === 0){
    let bag = shuffle(playlist.map(t => t.src));
    if(currentTrackSrc && bag.length > 1 && bag[0] === currentTrackSrc){
      const swapWith = 1 + Math.floor(Math.random() * (bag.length - 1));
      [bag[0], bag[swapWith]] = [bag[swapWith], bag[0]];
    }
    musicBag = bag;
  }
  return musicBag.shift();
}

/* moves the queue forward: replays the next track already in history if
   we'd previously stepped backward, otherwise draws a fresh one from the bag */
function nextMusicTrack(){
  if(historyPos < trackHistory.length - 1){
    historyPos++;
  } else {
    trackHistory.push(drawNextTrack());
    historyPos = trackHistory.length - 1;
  }
  currentTrackSrc = trackHistory[historyPos];
  return currentTrackSrc;
}

/* steps back to the previous track in history, if there is one */
function prevMusicTrack(){
  if(historyPos > 0){
    historyPos--;
    currentTrackSrc = trackHistory[historyPos];
    return currentTrackSrc;
  }
  return currentTrackSrc; // already at the earliest track — just restart it
}

/* plays a random track on loop while the pin screen is up — the intro track */
function startPinMusic(){
  if(pinMusicStarted) return;
  pinMusicStarted = true;
  bgAudio.src = nextMusicTrack();
  bgAudio.volume = 0.55;
  updateSongNameDisplay();
  bgAudio.play().catch(() => {
    setPlayPauseIcon(true);
  });
}
// browsers need a user gesture before audio can autoplay —
// start the intro track the moment the person starts typing the pin.
// (no { once: true } here — logging out resets pinMusicStarted so this
// needs to be able to fire again on the next visit to the pin screen)
pinInputs.forEach(input => {
  input.addEventListener('focus', startPinMusic);
  input.addEventListener('input', startPinMusic);
});
pinScreen.addEventListener('click', startPinMusic);

/* advances to the next track drawn from the shuffled bag */
function playNextInQueue(){
  bgAudio.src = nextMusicTrack();
  updateSongNameDisplay();
  bgAudio.play().catch(() => {
    setPlayPauseIcon(true);
  });
}

/* goes back to play the previous track */
function playPrevInQueue(){
  bgAudio.src = prevMusicTrack();
  updateSongNameDisplay();
  bgAudio.play().catch(() => {
    setPlayPauseIcon(true);
  });
}

function startMusic(){
  musicUnlocked = true;
  // if the intro track is already playing from the pin screen, let it
  // finish — the 'ended' listener below will draw the next one from the bag.
  if(bgAudio.paused || !bgAudio.src){
    playNextInQueue();
  } else {
    updateSongNameDisplay();
  }
}

bgAudio.addEventListener('ended', () => {
  if(!musicUnlocked){
    // still on the pin screen — keep the intro track looping
    bgAudio.currentTime = 0;
    bgAudio.play().catch(() => {});
  } else {
    playNextInQueue();
  }
});

musicPlayPauseBtn.addEventListener('click', () => {
  if(bgAudio.paused){
    if(!bgAudio.src){
      if(musicUnlocked) playNextInQueue(); else startPinMusic();
    } else {
      bgAudio.play().catch(()=>{});
    }
    setPlayPauseIcon(false);
  } else {
    bgAudio.pause();
    setPlayPauseIcon(true);
  }
});

musicNextBtn.addEventListener('click', () => {
  playNextInQueue();
  setPlayPauseIcon(false);
});

musicPrevBtn.addEventListener('click', () => {
  playPrevInQueue();
  setPlayPauseIcon(false);
});

/* ============================================================
   SETTINGS + LOG OUT
   ============================================================ */
const settingsToggle = document.getElementById('settingsToggle');
const settingsModal = document.getElementById('settingsModal');
const settingsModalClose = document.getElementById('settingsModalClose');
const logoutBtn = document.getElementById('logoutBtn');

settingsToggle.addEventListener('click', () => settingsModal.classList.remove('hidden'));
settingsModalClose.addEventListener('click', () => settingsModal.classList.add('hidden'));
settingsModal.addEventListener('click', (e) => { if(e.target === settingsModal) settingsModal.classList.add('hidden'); });

logoutBtn.addEventListener('click', logOut);

function logOut(){
  settingsModal.classList.add('hidden');

  // if logging out mid-gatcha, reset progress too
  if(activeSceneIndex === GATCHA_SCENE_INDEX){
    resetGatchaProgress();
    activeSceneIndex = 0;
  }

  // stop the music and reset the music state so a fresh shuffle starts next time
  bgAudio.pause();
  bgAudio.currentTime = 0;
  bgAudio.src = '';
  musicUnlocked = false;
  pinMusicStarted = false;
  musicBag = [];
  currentTrackSrc = null;
  trackHistory = [];
  historyPos = -1;
  setPlayPauseIcon(true);
  updateSongNameDisplay();

  // clear the entered pin
  pinInputs.forEach(i => i.value = '');

  // lock the app again
  app.classList.add('hidden');
  pinScreen.classList.remove('hidden');
  pinScreen.style.transition = 'none';
  pinScreen.style.opacity = '1';
  document.body.removeAttribute('data-mood');

  pinInputs[0].focus();
}

/* ============================================================
   SCENE 5 — FREEDOM WALL (public, shared, backed by Firebase
   Realtime Database via plain REST calls — no SDK needed)
   ============================================================ */

/* ---- SETUP (one-time) ----
   1. Go to https://console.firebase.google.com and create a free project.
   2. In the left sidebar: Build > Realtime Database > Create Database.
      Pick a location, start in "test mode" (locked-down mode also works —
      see the security rules note below).
   3. Once created, copy the database URL shown at the top
      (looks like: https://YOUR-PROJECT-default-rtdb.REGION.firebasedatabase.app)
   4. Paste it below as FIREBASE_DB_URL, replacing the placeholder.

   Security rules (Realtime Database > Rules tab) — since this is a small,
   unlisted, just-for-us wall, this simple public rule is enough:
     {
       "rules": {
         "freedomWall": {
           ".read": true,
           ".write": true
         }
       }
     }
   Anyone with the site's link (and its pin) can post here — nobody else
   will know the database URL, so this is low-risk for a private app
   like this one. Don't reuse this database for anything sensitive.
*/
const FIREBASE_DB_URL = "https://midnight-ange-default-rtdb.firebaseio.com/"; 
const WALL_NODE = "freedomWall";
const WALL_POLL_MS = 5000; // how often to re-check for new posts from others
const WALL_TILTS = [-3, -2, -1.2, 1, 1.8, 2.6, -2.6, 0.6]; // slight sticky-note rotation, cycled per post

function wallConfigured(){
  return FIREBASE_DB_URL && !FIREBASE_DB_URL.startsWith("PASTE_YOUR_");
}

function wallUrl(id){
  const path = id ? `${WALL_NODE}/${id}` : WALL_NODE;
  return `${FIREBASE_DB_URL}/${path}.json`;
}

const wallAddForm = document.getElementById('wallAddForm');
const wallNameInput = document.getElementById('wallNameInput');
const wallInput = document.getElementById('wallInput');
const wallPostBtn = document.getElementById('wallPostBtn');
const wallStatus = document.getElementById('wallStatus');
const wallGrid = document.getElementById('wallGrid');

let wallPosts = []; // [{id, text, name, createdAt}]
let wallPollTimer = null;

function setWallStatus(msg, isError){
  wallStatus.textContent = msg || '';
  wallStatus.style.color = isError ? 'var(--coral)' : 'var(--text-dim)';
}

async function loadWallPosts(){
  if(!wallConfigured()){
    setWallStatus('⚠️ the wall isn\'t set up yet — add your Firebase database URL in app.js.', true);
    wallInput.disabled = true;
    wallNameInput.disabled = true;
    wallPostBtn.disabled = true;
    renderWall();
    return;
  }
  try{
    const res = await fetch(wallUrl());
    if(!res.ok) throw new Error('bad response');
    const data = await res.json();
    wallPosts = data
      ? Object.entries(data).map(([id, v]) => ({ id, text: v.text, name: v.name || 'anonymous', createdAt: v.createdAt || 0 }))
      : [];
    wallPosts.sort((a, b) => b.createdAt - a.createdAt); // newest first
    setWallStatus('');
    renderWall();
  } catch(err){
    setWallStatus('couldn\'t reach the wall — check your connection.', true);
  }

  if(!wallPollTimer){
    wallPollTimer = setInterval(loadWallPosts, WALL_POLL_MS);
  }
}

function formatWallTime(ts){
  if(!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' +
         d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function renderWall(){
  if(!wallPosts.length){
    wallGrid.innerHTML = wallConfigured()
      ? `<p class="wall-empty">walang laman pa — post the first thing on the wall 👆</p>`
      : '';
    return;
  }
  wallGrid.innerHTML = wallPosts.map((post, i) => `
    <div class="wall-note" data-id="${post.id}" style="--tilt:${WALL_TILTS[i % WALL_TILTS.length]}deg; background:${wallNoteColor(i)};">
      <div class="wall-note-text">${escapeHtml(post.text)}</div>
      <div class="wall-note-footer">
        <span>— ${escapeHtml(post.name)}${post.createdAt ? ', ' + formatWallTime(post.createdAt) : ''}</span>
        <button class="wall-note-delete" data-action="delete" aria-label="remove this post">✕</button>
      </div>
    </div>
  `).join('');
}

const WALL_NOTE_COLORS = ['#f6e199', '#f7c9d6', '#c9e4f6', '#d9f2c4', '#f0d6f7', '#ffe0b8'];
function wallNoteColor(i){
  return WALL_NOTE_COLORS[i % WALL_NOTE_COLORS.length];
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

wallAddForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!wallConfigured()) return;
  const text = wallInput.value.trim();
  if(!text) return;
  const name = wallNameInput.value.trim() || 'anonymous';
  wallPostBtn.disabled = true;
  try{
    const res = await fetch(wallUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, name, createdAt: Date.now() })
    });
    if(!res.ok) throw new Error('post failed');
    wallInput.value = '';
    await loadWallPosts();
  } catch(err){
    setWallStatus('couldn\'t post that — try again.', true);
  } finally {
    wallPostBtn.disabled = false;
  }
});

wallGrid.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="delete"]');
  if(!btn) return;
  const note = e.target.closest('.wall-note');
  const id = note && note.dataset.id;
  if(!id) return;
  try{
    await fetch(wallUrl(id), { method: 'DELETE' });
    await loadWallPosts();
  } catch(err){ setWallStatus('couldn\'t remove that — try again.', true); }
});

// initial check so the "not set up yet" warning (or the wall) shows
// right away, even before the person navigates to this scene
loadWallPosts();
