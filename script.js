import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Конфигурация Firebase
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "dice1000-YOUR_ID.firebaseapp.com",
  databaseURL: "https://dice1000-YOUR_ID-default-rtdb.firebaseio.com",
  projectId: "dice1000-YOUR_ID",
  storageBucket: "dice1000-YOUR_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let currentRoomId = null;

// Состояние игры
let gameState = {
  currentDiceValues: [1, 1, 1, 1, 1],
  selectedDice: [false, false, false, false, false],
  lockedDice: [false, false, false, false, false],
  isRolling: false
};

// --- УПРАВЛЕНИЕ ЛОББИ И КОМНАТАМИ ---

function listenToRooms() {
  const roomsRef = ref(database, 'rooms');
  onValue(roomsRef, (snapshot) => {
    const roomsList = document.getElementById('rooms-list');
    if (!roomsList) return;
    roomsList.innerHTML = '';

    const data = snapshot.val();
    if (!data) {
      roomsList.innerHTML = '<p>Нет активных комнат. Создайте первую!</p>';
      return;
    }

    Object.keys(data).forEach((roomId) => {
      const room = data[roomId];
      const playersCount = room.players ? Object.keys(room.players).length : 0;
      
      if (playersCount < 4) {
        const roomItem = document.createElement('div');
        roomItem.className = 'room-card';
        roomItem.innerHTML = `
          <span>Комната <b>#${roomId.slice(-4)}</b> (${playersCount}/4)</span>
          <button onclick="joinGame('${roomId}')">Присоединиться</button>
        `;
        roomsList.appendChild(roomItem);
      }
    });
  });
}

window.createNewGame = function() {
  const roomsRef = ref(database, 'rooms');
  const newRoomRef = push(roomsRef);
  const roomId = newRoomRef.key;

  const initialRoomState = {
    createdAt: Date.now(),
    status: 'waiting',
    diceValues: [1, 1, 1, 1, 1],
    lockedDice: [false, false, false, false, false]
  };

  set(newRoomRef, initialRoomState).then(() => {
    window.joinGame(roomId);
  });
};

window.joinGame = function(roomId) {
  currentRoomId = roomId;
  document.getElementById('main-menu').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  document.getElementById('room-info').innerText = `Комната #${roomId.slice(-4)}`;

  const playerRef = ref(database, `rooms/${roomId}/players/player_${Date.now()}`);
  onDisconnect(playerRef).remove();

  renderDice();
};

window.leaveRoom = function() {
  currentRoomId = null;
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('main-menu').style.display = 'block';
};

// --- МОДАЛЬНОЕ ОКНО ПРАВИЛ ---

window.openRules = function() {
  document.getElementById('rules-modal').style.display = 'flex';
};

window.closeRules = function() {
  document.getElementById('rules-modal').style.display = 'none';
};

window.closeRulesOnOverlay = function(event) {
  if (event.target.id === 'rules-modal') {
    window.closeRules();
  }
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.closeRules();
});

// --- ЛОГИКА КУБИКОВ И ОЧКОВ ---

// Проверка, является ли кубик результативным
function isScoringDice(index) {
  if (gameState.lockedDice[index]) return false;

  const val = gameState.currentDiceValues[index];
  
  // 1 и 5 — всегда результативные
  if (val === 1 || val === 5) return true;

  // Считаем одинаковые значения среди незафиксированных костей
  const activeValues = gameState.currentDiceValues.filter((_, i) => !gameState.lockedDice[i]);
  const count = activeValues.filter(v => v === val).length;

  // Комбинация из 3+ одинаковых кубиков
  return count >= 3;
}

// Клик по кубику (выбираем или снимаем выбор)
window.toggleDiceSelect = function(index) {
  // Игнорируем зафиксированные кости
  if (gameState.lockedDice[index]) return;

  // БЛОКИРОВКА: Клик не работает, если кубик не приносит очков
  if (!isScoringDice(index)) return;

  gameState.selectedDice[index] = !gameState.selectedDice[index];
  renderDice();
};

// Бросок кубиков
window.rollDice = function() {
  if (gameState.isRolling) return;
  gameState.isRolling = true;

  // Генерируем новые значения незафиксированных кубиков
  for (let i = 0; i < 5; i++) {
    if (!gameState.lockedDice[i]) {
      gameState.currentDiceValues[i] = Math.floor(Math.random() * 6) + 1;
    }
  }

  // Автоматически выделяем ВСЕ результативные кубики
  for (let i = 0; i < 5; i++) {
    if (!gameState.lockedDice[i]) {
      gameState.selectedDice[i] = isScoringDice(i);
    }
  }

  renderDice();

  setTimeout(() => {
    gameState.isRolling = false;
  }, 200);
};

// Отрисовка кубиков и визуальных состояний
function renderDice() {
  for (let i = 0; i < 5; i++) {
    const diceEl = document.getElementById(`dice-${i}`);
    if (!diceEl) continue;

    diceEl.innerText = gameState.currentDiceValues[i];

    // Сброс классов
    diceEl.className = 'dice';

    if (gameState.lockedDice[i]) {
      diceEl.classList.add('locked');
    } else if (gameState.selectedDice[i]) {
      diceEl.classList.add('selected');
    } else if (isScoringDice(i)) {
      diceEl.classList.add('selectable');
    } else {
      diceEl.classList.add('disabled');
    }
  }
}

// Старт прослушивания комнат
listenToRooms();
