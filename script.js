import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. Конфигурация Firebase (замените своими ключами)
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

// Состояние игры
let currentRoomId = null;
let gameState = {
  currentDiceValues: [1, 1, 1, 1, 1],
  selectedDice: [false, false, false, false, false],
  lockedDice: [false, false, false, false, false],
  isRolling: false
};

// --- МЕНЮ И ЛОББИ ---

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

  // Очистка комнаты при выходе
  const playerRef = ref(database, `rooms/${roomId}/players/player_${Date.now()}`);
  onDisconnect(playerRef).remove();
};

// --- ПРАВИЛА И МОДАЛЬНОЕ ОКНО ---

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

// --- ЛОГИКА КУБИКОВ И ПРОВЕРКИ РЕЗУЛЬТАТИВНОСТИ ---

// Проверка, является ли конкретный кубик частью результативной комбинации
function isScoringDice(index) {
  if (gameState.lockedDice[index]) return false;

  const val = gameState.currentDiceValues[index];
  
  // 1 и 5 всегда приносят очки
  if (val === 1 || val === 5) return true;

  // Считаем количество таких же кубиков среди незафиксированных
  const activeValues = gameState.currentDiceValues.filter((_, i) => !gameState.lockedDice[i]);
  const count = activeValues.filter(v => v === val).length;

  // Три и более одинаковых кубика приносят очки
  return count >= 3;
}

// Переключение выбора кубика кликом
window.toggleDiceSelect = function(index) {
  // 1. Игнорируем зафиксированные ранее кубики
  if (gameState.lockedDice[index]) return;

  // 2. Блокируем клик, если кубик нерезультативный
  if (!isScoringDice(index)) return;

  // 3. Переключаем выбор только для результативных
  gameState.selectedDice[index] = !gameState.selectedDice[index];
  renderDice();
};

// Бросок кубиков с авто-выделением результативных
window.rollDice = function() {
  if (gameState.isRolling) return;
  gameState.isRolling = true;

  // Генерируем значения для незафиксированных кубиков
  for (let i = 0; i < 5; i++) {
    if (!gameState.lockedDice[i]) {
      gameState.currentDiceValues[i] = Math.floor(Math.random() * 6) + 1;
    }
  }

  // Автоматически выделяем только результативные кубики
  for (let i = 0; i < 5; i++) {
    if (!gameState.lockedDice[i]) {
      gameState.selectedDice[i] = isScoringDice(i);
    }
  }

  renderDice();

  setTimeout(() => {
    gameState.isRolling = false;
  }, 300);
};

function renderDice() {
  // Логика отрисовки кубиков в UI и обновления их состояний (selected / locked)
}

// Запуск прослушивания лобби при старте
listenToRooms();
