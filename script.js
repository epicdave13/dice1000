// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ FIREBASE И СОСТОЯНИЯ
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyApx6yyxu4avuWzOInTasy-hFMge7IUrV8",
    authDomain: "dice-1000-8da36.firebaseapp.com",
    projectId: "dice-1000-8da36",
    storageBucket: "dice-1000-8da36.firebasestorage.app",
    messagingSenderId: "782973038425",
    appId: "1:782973038425:web:f2e26c6f620b49952a2648",
    measurementId: "G-NSPFDRDEDY"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const urlParams = new URLSearchParams(window.location.search);
let roomID = urlParams.get('room');

if (!roomID) {
    roomID = Math.floor(1000 + Math.random() * 9000);
    window.history.pushState({}, '', `?room=${roomID}`);
}

const gameRef = database.ref(`rooms/${roomID}`);

let isRolling = false;
let activePlayersMap = {};

let savedName = sessionStorage.getItem(`dice_player_name_${roomID}`);
if (!savedName) {
    savedName = prompt("Введите ваше имя:") || "";
    if (!savedName.trim()) {
        savedName = "Игрок " + Math.floor(Math.random() * 100);
    }
    sessionStorage.setItem(`dice_player_name_${roomID}`, savedName.trim());
} else {
    savedName = savedName.trim();
}

let myPlayerIndex = null;

const faceTransforms = {
    1: 'rotateX(0deg) rotateY(0deg)',
    6: 'rotateX(180deg) rotateY(0deg)',
    3: 'rotateY(-90deg)',
    4: 'rotateY(90deg)',
    2: 'rotateX(-90deg)',
    5: 'rotateX(90deg)'
};

let gameState = {
    gameStarted: false,
    currentPlayer: 0,
    players: [],
    turnScore: 0,
    isFirstRollInTurn: true,
    mustConfirm: false,
    lastRollDiceObjects: [],
    lastCalculatedScore: 0,
    diceVisuals: [
        { hidden: true, locked: false, rx: 0, ry: 0, value: 1 },
        { hidden: true, locked: false, rx: 0, ry: 0, value: 1 },
        { hidden: true, locked: false, rx: 0, ry: 0, value: 1 },
        { hidden: true, locked: false, rx: 0, ry: 0, value: 1 },
        { hidden: true, locked: false, rx: 0, ry: 0, value: 1 }
    ],
    selectedDiceIds: [false, false, false, false, false]
};

const cubeTemplate = (id) => `
    <div class="scene hidden" id="scene-${id}" onclick="toggleSelect(${id})">
        <div class="cube" id="cube-${id}">
            <div class="face front"><div class="dot"></div></div>
            <div class="face back six">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
            </div>
            <div class="face right three">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
            </div>
            <div class="face left four">
                <div class="dot"></div><div class="dot"></div>
                <div class="dot"></div><div class="dot"></div>
            </div>
            <div class="face top two">
                <div class="dot"></div><div class="dot"></div>
            </div>
            <div class="face bottom five">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                <div class="dot"></div><div class="dot"></div>
            </div>
        </div>
    </div>
`;

const board = document.getElementById('game-board');
for (let i = 0; i < 5; i++) {
    board.innerHTML += cubeTemplate(i);
}

if (!document.getElementById('game-ui')) {
    const uiDiv = document.createElement('div');
    uiDiv.id = 'game-ui';
    uiDiv.style.margin = '0 0 20px 0';
    uiDiv.style.width = '100%';
    uiDiv.style.display = 'flex';
    uiDiv.style.flexDirection = 'column';
    uiDiv.style.alignItems = 'center';
    uiDiv.innerHTML = `
        <div id="room-link-info" style="font-size:14px; background:#00000040; padding:12px; border-radius:8px; margin-bottom:15px; text-align:center; width:90%; max-width:400px; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; gap:8px;">
            <div>Комната: <b>${roomID}</b></div>
            <button onclick="copyRoomLink()" class="btn" style="padding:6px 14px; font-size:13px; background:#3498db; margin:0;">
                Скопировать ссылку
            </button>
        </div>
        <table class="score-table">
            <thead><tr><th>Игрок</th><th>Счет</th><th>Болты</th><th>Статус</th></tr></thead>
            <tbody id="score-table-body"></tbody>
        </table>
        <div id="player-turn" style="font-weight:bold; color:#f1c40f; margin: 15px 0 5px 0; font-size:20px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Подключение...</div>
        <div id="turn-status" style="color:#2ecc71; font-size: 18px; font-weight: bold; margin-bottom: 20px;">Очки за ход: 0</div>
    `;
    document.body.prepend(uiDiv);
}

if (!document.getElementById('bank-btn')) {
    const bankBtn = document.createElement('button');
    bankBtn.id = 'bank-btn';
    bankBtn.className = 'btn';
    bankBtn.style.backgroundColor = '#2ecc71';
    bankBtn.style.marginTop = '10px';
    bankBtn.innerText = 'ЗАПИСАТЬ ОЧКИ';
    bankBtn.onclick = bankScore;
    document.getElementById('roll-btn').parentNode.appendChild(bankBtn);
}

// ==========================================
// 2. ВСПЛЫВАЮЩИЕ УВЕДОМЛЕНИЯ И КОПИРОВАНИЕ
// ==========================================

function copyRoomLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        showToast("Ссылка на комнату скопирована!", "success");
    }).catch(err => {
        showToast("Не удалось скопировать ссылку", "danger");
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// ==========================================
// 3. МАТЕМАТИКА И СЕТЕВАЯ СИНХРОНИЗАЦИЯ
// ==========================================

// Функция возвращает не только очки, но и группировку индексов комбинаций
function calculateDiceScore(diceObjects) {
    if (!diceObjects || diceObjects.length === 0) {
        return { score: 0, scoringDiceCount: 0, scoringIndices: [], groups: [] };
    }

    let counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    diceObjects.forEach(d => counts[d.value]++);

    let scoringIndices = [];
    let groups = [];

    if (diceObjects.length === 5) {
        let isSmallStraight = Object.values(counts).slice(0, 5).every(v => v === 1);
        let isBigStraight = Object.values(counts).slice(1, 6).every(v => v === 1);

        if (isBigStraight || isSmallStraight) {
            let score = isBigStraight ? 250 : 125;
            let indices = diceObjects.map(d => d.index);
            return {
                score: score,
                scoringDiceCount: 5,
                scoringIndices: indices,
                groups: [indices]
            };
        }
    }

    let score = 0;
    let scoringDiceCount = 0;
    let handledNums = {};

    for (let num = 1; num <= 6; num++) {
        let count = counts[num];

        if (count >= 3) {
            handledNums[num] = true;
            scoringDiceCount += count;

            let groupIndices = [];
            diceObjects.forEach(d => {
                if (d.value === num) {
                    scoringIndices.push(d.index);
                    groupIndices.push(d.index);
                }
            });
            groups.push(groupIndices);

            if (count === 5) {
                let nominal = (num === 1) ? 10 : num;
                score += nominal * 100;
            }
            else if (count === 4) {
                let tripleValue = (num === 1) ? 100 : num * 10;
                score += tripleValue * 2;
            }
            else if (count === 3) {
                score += (num === 1) ? 100 : num * 10;
            }
        }
    }

    diceObjects.forEach(d => {
        if (handledNums[d.value]) return;

        if (d.value === 1) {
            score += 10;
            scoringDiceCount++;
            scoringIndices.push(d.index);
            groups.push([d.index]);
        } else if (d.value === 5) {
            score += 5;
            scoringDiceCount++;
            scoringIndices.push(d.index);
            groups.push([d.index]);
        }
    });

    return {
        score: score,
        scoringDiceCount: scoringDiceCount,
        scoringIndices: scoringIndices,
        groups: groups
    };
}

function setupPresence(playerIndex) {
    const myPresenceRef = database.ref(`rooms/${roomID}/activePlayers/${playerIndex}`);
    const connectedRef = database.ref('.info/connected');

    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            myPresenceRef.onDisconnect().remove();
            myPresenceRef.set(true);

            database.ref(`rooms/${roomID}/activePlayers`).once('value', (snapshot) => {
                const active = snapshot.val() || {};
                const activeKeys = Object.keys(active);
                if (activeKeys.length <= 1) {
                    gameRef.onDisconnect().remove();
                } else {
                    gameRef.onDisconnect().cancel();
                }
            });
        }
    });
}

database.ref(`rooms/${roomID}/activePlayers`).on('value', (snapshot) => {
    const activePlayers = snapshot.val();
    const activeKeys = activePlayers ? Object.keys(activePlayers).filter(k => activePlayers[k] === true) : [];
    
    if (activeKeys.length === 0) {
        activePlayersMap = {};
        gameRef.remove();
    } else {
        activePlayersMap = activePlayers;
    }
    updateUI();
});

gameRef.on('value', (snapshot) => {
    const data = snapshot.val();

    if (!data) {
        gameState.players = [{
            name: savedName,
            totalScore: 0,
            bolts: 0,
            barrelAttempts: 0,
            hasEnteredGame: false
        }];
        myPlayerIndex = 0;
        gameRef.set(gameState);
        setupPresence(myPlayerIndex);
        return;
    }

    gameState = data;
    if (!gameState.players) gameState.players = [];
    if (!gameState.lastRollDiceObjects) gameState.lastRollDiceObjects = [];

    if (myPlayerIndex === null) {
        let existingIndex = gameState.players.findIndex(p => p.name === savedName);
        if (existingIndex !== -1) {
            myPlayerIndex = existingIndex;
        } else {
            myPlayerIndex = gameState.players.length;
            gameState.players.push({
                name: savedName,
                totalScore: 0,
                bolts: 0,
                barrelAttempts: 0,
                hasEnteredGame: false
            });
            gameRef.child('players').set(gameState.players);
        }
        setupPresence(myPlayerIndex);
    }

    for (let i = 0; i < 5; i++) {
        const scene = document.getElementById(`scene-${i}`);
        const cube = document.getElementById(`cube-${i}`);
        const dv = gameState.diceVisuals[i];

        if (dv.hidden) {
            scene.classList.add('hidden');
        } else {
            scene.classList.remove('hidden');
        }

        if (gameState.selectedDiceIds[i]) {
            scene.classList.add('selected');
        } else {
            scene.classList.remove('selected');
        }

        if (dv.locked) {
            scene.classList.add('locked');
        } else {
            scene.classList.remove('locked');
        }

        cube.style.transform = `rotateX(${dv.rx}deg) rotateY(${dv.ry}deg) ${faceTransforms[dv.value]}`;
    }

    updateUI();
});

// ==========================================
// 4. СЕТЕВОЙ БРОСОК И ВЫБОР РЕЗУЛЬТАТИВНЫХ КОСТЕЙ
// ==========================================

function toggleSelect(id) {
    if (gameState.currentPlayer !== myPlayerIndex || isRolling) return;
    if (gameState.mustConfirm) return;
    if (!gameState.lastRollDiceObjects) gameState.lastRollDiceObjects = [];

    // Проверяем, принадлежит ли кубик текущему броску
    let isDiceFromCurrentRoll = gameState.lastRollDiceObjects.some(d => d.index === id);
    if (!isDiceFromCurrentRoll && !gameState.isFirstRollInTurn) {
        showToast("Этот кубик отложен на предыдущем броске, его нельзя вернуть в игру!", "warning");
        return;
    }

    // Считаем доступные комбинации в текущем броске
    const rollAnalysis = calculateDiceScore(gameState.lastRollDiceObjects);

    // Ограничение: нельзя выбырать нерезультативный кубик
    if (!rollAnalysis.scoringIndices.includes(id)) {
        showToast("Нельзя выбрать этот кубик, он не принес очков!", "warning");
        return;
    }

    // Находим группу, к которой принадлежит кликнутый кубик (например, тройка или стриты)
    let targetGroup = rollAnalysis.groups.find(group => group.includes(id));
    if (!targetGroup) return;

    // Переключаем состояние всей группы одновременно
    let targetState = !gameState.selectedDiceIds[id];
    targetGroup.forEach(idx => {
        gameState.selectedDiceIds[idx] = targetState;
    });

    recalculateScoreFromSelected();
}

function recalculateScoreFromSelected() {
    if (!gameState.lastRollDiceObjects) gameState.lastRollDiceObjects = [];
    let currentlySelectedObjects = [];

    gameState.lastRollDiceObjects.forEach(d => {
        if (gameState.selectedDiceIds[d.index]) {
            currentlySelectedObjects.push(d);
        }
    });

    const calculation = calculateDiceScore(currentlySelectedObjects);
    let previousTurnsScore = gameState.turnScore - (gameState.lastCalculatedScore || 0);

    gameState.lastCalculatedScore = calculation.score;
    gameState.turnScore = previousTurnsScore + calculation.score;

    gameRef.update({
        selectedDiceIds: gameState.selectedDiceIds,
        turnScore: gameState.turnScore,
        lastCalculatedScore: gameState.lastCalculatedScore
    });
}

function rollAll() {
    if (gameState.currentPlayer !== myPlayerIndex) {
        showToast("Сейчас ход другого игрока! Ожидайте.", "warning");
        return;
    }

    if (isRolling) return;
    if (!gameState.lastRollDiceObjects) gameState.lastRollDiceObjects = [];

    let selectedCountFromLastRoll = 0;
    gameState.lastRollDiceObjects.forEach(d => {
        if (gameState.selectedDiceIds[d.index]) {
            selectedCountFromLastRoll++;
        }
    });

    if (!gameState.isFirstRollInTurn && !gameState.mustConfirm && selectedCountFromLastRoll === 0) {
        showToast("Вы должны оставить отложенным хотя бы один результативный кубик из ТЕКУЩЕГО броска!", "warning");
        return;
    }

    isRolling = true;
    updateUI();

    let activeIndices = [];

    if (gameState.isFirstRollInTurn) {
        gameState.turnScore = 0;
        gameState.lastCalculatedScore = 0;
        gameState.lastRollDiceObjects = [];
        for (let i = 0; i < 5; i++) {
            gameState.selectedDiceIds[i] = false;
            gameState.diceVisuals[i] = { hidden: false, locked: false, rx: 0, ry: 0, value: 1 };
            activeIndices.push(i);
        }
    } else if (gameState.mustConfirm) {
        for (let i = 0; i < 5; i++) {
            gameState.selectedDiceIds[i] = false;
            gameState.diceVisuals[i].locked = false;
            activeIndices.push(i);
        }
        gameState.mustConfirm = false;
    } else {
        for (let i = 0; i < 5; i++) {
            if (gameState.selectedDiceIds[i]) {
                gameState.diceVisuals[i].locked = true;
            } else {
                activeIndices.push(i);
            }
        }
    }

    let diceObjects = [];
    activeIndices.forEach(idx => {
        const result = Math.floor(Math.random() * 6) + 1;
        diceObjects.push({ index: idx, value: result });

        gameState.diceVisuals[idx].rx = (Math.floor(Math.random() * 4) + 2) * 360;
        gameState.diceVisuals[idx].ry = (Math.floor(Math.random() * 4) + 2) * 360;
        gameState.diceVisuals[idx].value = result;
        gameState.diceVisuals[idx].hidden = false;
    });

    gameState.lastRollDiceObjects = diceObjects;
    gameState.lastCalculatedScore = 0;

    gameRef.update({
        diceVisuals: gameState.diceVisuals,
        selectedDiceIds: gameState.selectedDiceIds,
        mustConfirm: gameState.mustConfirm,
        lastRollDiceObjects: gameState.lastRollDiceObjects,
        lastCalculatedScore: gameState.lastCalculatedScore
    });

    setTimeout(() => {
        isRolling = false;
        const calculation = calculateDiceScore(diceObjects);
        const activePlayer = gameState.players[myPlayerIndex];

        if (calculation.score === 0) {
            let message = `Выпало 0 очков! Ход переходит к следующему игроку.`;

            if (gameState.isFirstRollInTurn && activePlayer.totalScore >= 50 && !isPlayerOnBarrel(activePlayer.totalScore)) {
                activePlayer.bolts++;
                message = `Ноль очков! Вы получаете БОЛТ.`;
                if (activePlayer.bolts >= 3) {
                    activePlayer.bolts = 0;
                    activePlayer.totalScore -= 100;
                    message += ` Три болта превращаются в минус 100 очков!`;
                }
            }

            showToast(message, "danger");
            endTurn(false);
            return;
        }

        // Автоматически выделяем все выпавшие результативные кубики (целиком)
        calculation.scoringIndices.forEach(idx => {
            gameState.selectedDiceIds[idx] = true;
        });

        gameState.lastCalculatedScore = calculation.score;
        gameState.turnScore += calculation.score;
        gameState.isFirstRollInTurn = false;

        if (calculation.scoringDiceCount === activeIndices.length) {
            gameState.mustConfirm = true;
            showToast(`Все кубики сыграли! Вы набрали ${gameState.turnScore}. Вы ОБЯЗАНЫ подтвердить сумму броском всех 5 кубиков.`, "warning");
        }

        gameRef.update({
            selectedDiceIds: gameState.selectedDiceIds,
            turnScore: gameState.turnScore,
            lastCalculatedScore: gameState.lastCalculatedScore,
            isFirstRollInTurn: gameState.isFirstRollInTurn,
            mustConfirm: gameState.mustConfirm,
            players: gameState.players
        });
    }, 1200);
}

function bankScore() {
    if (gameState.currentPlayer !== myPlayerIndex || isRolling) return;
    if (!gameState.lastRollDiceObjects) gameState.lastRollDiceObjects = [];

    if (gameState.mustConfirm) {
        showToast("Вы не можете записать очки сейчас! Требуется подтверждающий бросок.", "warning");
        return;
    }

    // Запрет записи 0 очков
    if (!gameState.turnScore || gameState.turnScore === 0) {
        showToast("Нельзя записать 0 очков! Сначала выберите результативные кубики.", "warning");
        return;
    }

    let selectedCountFromLastRoll = 0;
    gameState.lastRollDiceObjects.forEach(d => {
        if (gameState.selectedDiceIds[d.index]) {
            selectedCountFromLastRoll++;
        }
    });

    if (!gameState.isFirstRollInTurn && selectedCountFromLastRoll === 0) {
        showToast("Вы должны оставить отложенными результативные кубики текущего броска перед записью!", "warning");
        return;
    }
    endTurn(true);
}

// ==========================================
// 5. ПРАВИЛА (БОЧКИ, ОБГОНЫ, САМОСВАЛ) И UI
// ==========================================

function checkOvertake() {
    const currentIdx = gameState.currentPlayer;
    const currentPlayer = gameState.players[currentIdx];
    let oldScore = currentPlayer.totalScore - gameState.turnScore;

    gameState.players.forEach((oppPlayer, oppIdx) => {
        if (oppIdx !== currentIdx && oppPlayer.totalScore > 0) {
            if (oldScore <= oppPlayer.totalScore && currentPlayer.totalScore > oppPlayer.totalScore) {
                oppPlayer.totalScore = Math.max(0, oppPlayer.totalScore - 50);
                showToast(`Обгон! ${currentPlayer.name} обошел ${oppPlayer.name}. У соперника списано 50 очков!`, "success");
            }
        }
    });
}

function endTurn(saveScore) {
    const player = gameState.players[gameState.currentPlayer];

    if (saveScore) {
        if (!player.hasEnteredGame && gameState.turnScore < 50) {
            showToast(`Чтобы открыть счет в игре, нужно набрать минимум 50 очков за один ход! У вас сейчас: ${gameState.turnScore}`, "warning");
            return;
        }

        if (!player.hasEnteredGame && gameState.turnScore >= 50) {
            player.hasEnteredGame = true;
        }

        let proposedScore = player.totalScore + gameState.turnScore;

        if (player.totalScore >= 200 && player.totalScore < 300 && proposedScore < 300) {
            showToast(`Вы застряли на бочке (${player.totalScore})! Нельзя записать мелкую сумму. Вам нужно вырваться за 300! Сейчас было бы: ${proposedScore}`, "warning");
            return;
        }
        if (player.totalScore >= 600 && player.totalScore < 700 && proposedScore < 700) {
            showToast(`Вы застряли на бочке (${player.totalScore})! Нельзя записать мелкую сумму. Вам нужно вырваться за 700! Сейчас было бы: ${proposedScore}`, "warning");
            return;
        }

        if (player.totalScore >= 880 && player.totalScore < 1000 && proposedScore < 1000) {
            showToast(`Вы в капкане финальной бочки (${player.totalScore})! Запись мелких очков заблокирована. Вам нужно выбить ровно 1000 или больше! Сейчас было бы: ${proposedScore}`, "warning");
            return;
        }

        if (player.totalScore < 200 && proposedScore >= 200 && proposedScore < 300) {
            showToast(`Вы попали на БОЧКУ (Счет: ${proposedScore})! В следующий ход придется добирать до 300.`, "warning");
        }
        else if (player.totalScore < 600 && proposedScore >= 600 && proposedScore < 700) {
            showToast(`Вы попали на БОЧКУ (Счет: ${proposedScore})! В следующий ход придется добирать до 700.`, "warning");
        }
        else if (player.totalScore < 880 && proposedScore >= 880 && proposedScore < 1000) {
            player.barrelAttempts = 0;
            showToast(`ВХОД НА ФИНАЛЬНУЮ БОЧКУ! (Счет: ${proposedScore}). У вас есть ровно 3 хода, чтобы закончить игру!`, "warning");
        }

        if (proposedScore >= 1000) {
            player.barrelAttempts = 0;
        }

        player.totalScore = proposedScore;

        if (player.totalScore === 555) {
            player.totalScore = 0;
            showToast("САМОСВАЛ! Ваш счет равен 555 и полностью обнуляется.", "danger");
        }

        checkOvertake();

        if (player.totalScore >= 1000) {
            showToast(`Поздравляем! Игрок ${player.name} победил, набрав ${player.totalScore} очков!`, "success");
            resetGame();
            return;
        }
    } else {
        if (player.totalScore >= 880 && player.totalScore < 1000) {
            player.barrelAttempts++;
            if (player.barrelAttempts >= 3) {
                player.totalScore -= 100;
                player.barrelAttempts = 0;
                showToast("3 попытки на финальной бочке истекли! Штраф минус 100 очков и вы слетаете с бочки.", "danger");
            } else {
                showToast(`Ход сгорел! Использована попытка на финальной бочке. Осталось попыток: ${3 - player.barrelAttempts}`, "warning");
            }
        }
    }

    gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;
    gameState.turnScore = 0;
    gameState.isFirstRollInTurn = true;
    gameState.mustConfirm = false;
    gameState.lastRollDiceObjects = [];
    gameState.lastCalculatedScore = 0;

    for (let i = 0; i < 5; i++) {
        gameState.selectedDiceIds[i] = false;
        gameState.diceVisuals[i] = { hidden: true, locked: false, rx: 0, ry: 0, value: 1 };
    }

    gameRef.set(gameState);
}

function isPlayerOnBarrel(score) {
    if ((score >= 200 && score < 300) || (score >= 600 && score < 700) || (score >= 880 && score < 1000)) return true;
    return false;
}

function updateUI() {
    if (!gameState.players || !Array.isArray(gameState.players)) return;

    const activeIndex = gameState.currentPlayer;

    const turnElement = document.getElementById('player-turn');
    if (turnElement) {
        turnElement.innerText = `Ход: ${activeIndex === myPlayerIndex ? 'ВАШ ХОД!' : `Ходит ${gameState.players[activeIndex]?.name || 'соперник'}`}`;
    }

    const rollBtn = document.getElementById('roll-btn');
    const bankBtn = document.getElementById('bank-btn');
    if (rollBtn && bankBtn) {
        if (activeIndex === myPlayerIndex && !isRolling) {
            rollBtn.disabled = false;
            rollBtn.style.opacity = "1";
            bankBtn.disabled = false;
            bankBtn.style.opacity = "1";
        } else {
            rollBtn.disabled = true;
            rollBtn.style.opacity = "0.4";
            bankBtn.disabled = true;
            bankBtn.style.opacity = "0.4";
        }
    }

    const getBoltStars = (bolts = 0) => {
        if (bolts === 0) return "<span style='color:rgba(255,255,255,0.2)'>✕ ✕ ✕</span>";
        if (bolts === 1) return "<span class='bolt-indicator'>⚡</span> <span style='color:rgba(255,255,255,0.2)'>✕ ✕</span>";
        if (bolts === 2) return "<span class='bolt-indicator'>⚡ ⚡</span> <span style='color:rgba(255,255,255,0.2)'>✕</span>";
        return "<span class='bolt-indicator'>⚡ ⚡ ⚡</span>";
    };

    const getStatusBadge = (playerObj, playerIdx) => {
        const isOnline = Boolean(activePlayersMap && activePlayersMap[playerIdx] === true);
        if (!isOnline) {
            return "<span class='status-badge' style='background:#7f8c8d;'>Оффлайн</span>";
        }

        let score = playerObj.totalScore || 0;
        if ((score >= 200 && score < 300) || (score >= 600 && score < 700)) {
            return "<span class='status-badge barrel'>На бочке</span>";
        }
        if (score >= 880 && score < 1000) {
            return `<span class='status-badge barrel'>ФИНАЛ (${3 - (playerObj.barrelAttempts || 0)} ходов)</span>`;
        }
        return "<span class='status-badge' style='background:#2ecc71;'>В сети</span>";
    };

    const tableBody = document.getElementById('score-table-body');
    if (tableBody) {
        tableBody.innerHTML = gameState.players.map((p, idx) => `
            <tr class="${activeIndex === idx ? 'active-row' : ''}">
                <td>${idx === myPlayerIndex ? `${p.name} (Вы)` : p.name}</td>
                <td><b>${p.totalScore || 0}</b></td>
                <td>${getBoltStars(p.bolts)}</td>
                <td>${getStatusBadge(p, idx)}</td>
            </tr>
        `).join('');
    }

    const turnStatus = document.getElementById('turn-status');
    if (turnStatus) {
        turnStatus.innerText = `Очки за ход: ${gameState.turnScore || 0}`;
    }

    if (bankBtn) {
        if (gameState.mustConfirm) {
            bankBtn.style.backgroundColor = '#7f8c8d';
            bankBtn.innerText = 'ПОДТВЕРДИТЕ БРОСКОМ';
        } else {
            bankBtn.style.backgroundColor = '#2ecc71';
            bankBtn.innerText = 'ЗАПИСАТЬ ОЧКИ';
        }
    }
}

function resetGame() {
    gameRef.remove();
}
