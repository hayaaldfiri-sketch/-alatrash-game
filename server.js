const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>لعبة الأطرش - لمة</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #1a1a2e; color: #eee; text-align: center; padding: 20px; min-height: 100vh; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { margin-bottom: 20px; color: #e94560; font-size: 2em; }
    input, button, select { padding: 12px; margin: 5px; border-radius: 8px; border: none; font-size: 16px; width: 80%; max-width: 300px; }
    button { background: #e94560; color: white; cursor: pointer; transition: 0.3s; font-weight: bold; }
    button:hover { background: #c73b54; transform: scale(1.02); }
    button:disabled { background: #555; cursor: not-allowed; transform: none; }
    .card { background: #16213e; border-radius: 12px; padding: 20px; margin: 10px 0; box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
    .hidden { display: none !important; }
    .players-list { list-style: none; padding: 0; margin: 10px 0; }
    .players-list li { padding: 12px; margin: 4px 0; background: #0f3460; border-radius: 8px; cursor: pointer; transition: 0.2s; display: flex; justify-content: space-between; align-items: center; }
    .players-list li:hover { background: #1a508b; }
    #question { font-size: 24px; font-weight: bold; margin: 20px 0; color: #f0c929; word-wrap: break-word; }
    #categorySelect { background: #0f3460; color: #eee; }
    .small-btn { width: auto; padding: 8px 15px; font-size: 14px; background: #0f3460; }
    .small-btn:hover { background: #1a508b; }
    #loginError { color: #e94560; margin-top: 10px; font-weight: bold; }
    .score-badge { background: #e94560; padding: 4px 10px; border-radius: 12px; font-size: 14px; font-weight: bold; }
    #hostLabel { color: #4ecca3; font-weight: bold; }
    @media (max-width: 480px) {
      input, button, select { width: 90%; }
      h1 { font-size: 1.5em; }
    }
  </style>
</head>
<body>
  <div class="container" id="app">
    <h1>🎮 لعبة الأطرش</h1>

    <div id="loginScreen" class="card">
      <input type="text" id="playerNameInput" placeholder="أدخل اسمك" maxlength="15" autocomplete="off">
      <br>
      <button onclick="createRoom()">🎯 إنشاء غرفة جديدة</button>
      <br><br>
      <input type="text" id="roomCodeInput" placeholder="رمز الغرفة" maxlength="4" autocomplete="off" style="text-transform:uppercase;">
      <button onclick="joinRoom()">🚪 انضمام</button>
      <p id="loginError"></p>
    </div>

    <div id="roomScreen" class="card hidden">
      <h2>🏠 غرفة: <span id="roomCodeDisplay" style="color:#f0c929;"></span></h2>
      <p id="hostLabel" style="display:none;">👑 أنت المضيف</p>
      <ul id="playersList" class="players-list"></ul>

      <div id="categorySelection" class="hidden">
        <label>📂 اختر فئة الأسئلة:</label>
        <select id="categorySelect">
          <option value="مشاهير">🌟 مشاهير</option>
          <option value="أكلات">🍽️ أكلات</option>
          <option value="أفلام">🎬 أفلام</option>
          <option value="رياضة">⚽ رياضة</option>
          <option value="حيوانات">🐾 حيوانات</option>
          <option value="جغرافيا">🌍 جغرافيا</option>
        </select>
        <button onclick="selectCategory()">✔️ تأكيد الفئة</button>
      </div>

      <div id="startButtonDiv" class="hidden">
        <button onclick="startRound()">🚀 ابدأ الجولة</button>
        <button class="small-btn" onclick="skipToVote()">⏩ اذهب للتصويت الآن</button>
      </div>
      <p id="categoryMessage" style="color:#4ecca3; font-weight:bold;"></p>
    </div>

    <div id="roundScreen" class="card hidden">
      <h2>🔒 سؤالك السري</h2>
      <div id="question"></div>
      <p>💬 تناقشوا مع بعض... ثم صوتوا على من هو الأطرش!</p>
    </div>

    <div id="voteScreen" class="card hidden">
      <h2>🗳️ صوّت على الأطرش</h2>
      <p>اضغط على اسم اللاعب الذي تشك به:</p>
      <ul id="votePlayersList" class="players-list"></ul>
      <p id="voteCountMessage" style="color:#f0c929;"></p>
    </div>

    <div id="resultScreen" class="card hidden">
      <h2>🏆 النتيجة</h2>
      <div id="resultMessage" style="font-size:20px; margin:15px 0;"></div>
      <ul id="resultPlayersList" class="players-list"></ul>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let currentRoomCode = null;
    let isHost = false;
    let players = [];
    let currentQuestion = null;

    function showScreen(screenId) {
      document.querySelectorAll('#app > div').forEach(d => d.classList.add('hidden'));
      document.getElementById(screenId).classList.remove('hidden');
    }

    function createRoom() {
      const name = document.getElementById('playerNameInput').value.trim();
      if (!name) { showError('الرجاء إدخال اسمك'); return; }
      clearError();
      socket.emit('createRoom', name);
    }

    function joinRoom() {
      const name = document.getElementById('playerNameInput').value.trim();
      const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
      if (!name || !code) { showError('الرجاء إدخال الاسم ورمز الغرفة'); return; }
      clearError();
      socket.emit('joinRoom', { roomCode: code, playerName: name });
    }

    function selectCategory() {
      const cat = document.getElementById('categorySelect').value;
      socket.emit('selectCategory', { roomCode: currentRoomCode, category: cat });
    }

    function startRound() {
      socket.emit('startRound', currentRoomCode);
    }

    function skipToVote() {
      socket.emit('skipToVote', currentRoomCode);
    }

    function vote(suspectId) {
      socket.emit('vote', { roomCode: currentRoomCode, suspectId });
      document.getElementById('voteScreen').classList.add('hidden');
      const tempMsg = document.createElement('div');
      tempMsg.className = 'card';
      tempMsg.id = 'waitingMsg';
      tempMsg.innerHTML = '<p>✅ تم تسجيل تصويتك، انتظر النتيجة...</p>';
      document.getElementById('app').appendChild(tempMsg);
    }

    function showError(msg) { document.getElementById('loginError').textContent = '⚠️ ' + msg; }
    function clearError() { document.getElementById('loginError').textContent = ''; }

    socket.on('roomCreated', ({ roomCode, players: pl }) => {
      currentRoomCode = roomCode;
      isHost = true;
      players = pl;
      document.getElementById('roomCodeDisplay').textContent = roomCode;
      document.getElementById('hostLabel').style.display = 'block';
      updateRoomUI();
      showScreen('roomScreen');
    });

    socket.on('playerJoined', (pl) => { players = pl; updateRoomUI(); });
    socket.on('playerLeft', (pl) => { players = pl; updateRoomUI(); });
    socket.on('error', (msg) => { showError(msg); });

    socket.on('categorySelected', (cat) => {
      document.getElementById('categoryMessage').textContent = '📂 الفئة المختارة: ' + cat;
      if (isHost) document.getElementById('startButtonDiv').classList.remove('hidden');
    });

    socket.on('newRound', ({ question, players: pl }) => {
      players = pl;
      currentQuestion = question;
      document.getElementById('question').textContent = '❓ ' + question;
      const wm = document.getElementById('waitingMsg');
      if (wm) wm.remove();
      showScreen('roundScreen');
    });

    socket.on('roundStarted', ({ players: pl }) => {
      players = pl;
      if (!currentQuestion) document.getElementById('question').textContent = '⏳ انتظر سؤالك...';
      showScreen('roundScreen');
    });

    socket.on('votingPhase', (playersList) => {
      const list = document.getElementById('votePlayersList');
      list.innerHTML = '';
      playersList.forEach(p => {
        if (p.id !== socket.id) {
          const li = document.createElement('li');
          li.innerHTML = '👤 ' + p.name;
          li.onclick = () => { vote(p.id); };
          list.appendChild(li);
        }
      });
      document.getElementById('voteCountMessage').textContent = '';
      const wm = document.getElementById('waitingMsg');
      if (wm) wm.remove();
      showScreen('voteScreen');
    });

    socket.on('voteUpdate', (votesCount, total) => {
      const msg = document.getElementById('voteCountMessage');
      if (msg) msg.textContent = '🗳️ تم التصويت: ' + votesCount + ' من ' + total;
    });

    socket.on('roundResult', ({ atrash, atrashCaught, players: pl }) => {
      players = pl;
      const msgDiv = document.getElementById('resultMessage');
      if (atrashCaught) {
        msgDiv.innerHTML = '🎉 <b>' + atrash + '</b> انكشف! الأطرش تم الإمساك به!';
        msgDiv.style.color = '#4ecca3';
      } else {
        msgDiv.innerHTML = '😈 <b>' + atrash + '</b> نجا! لم يتم كشف الأطرش!';
        msgDiv.style.color = '#e94560';
      }
      const list = document.getElementById('resultPlayersList');
      list.innerHTML = '';
      pl.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = '👤 ' + p.name + ' <span class="score-badge">' + p.score + ' نقطة</span>';
        if (p.id === socket.id) li.style.border = '2px solid #f0c929';
        list.appendChild(li);
      });
      const wm = document.getElementById('waitingMsg');
      if (wm) wm.remove();
      showScreen('resultScreen');
    });

    socket.on('readyForNewRound', (pl) => {
      players = pl;
      currentQuestion = null;
      updateRoomUI();
      document.getElementById('startButtonDiv').classList.remove('hidden');
      document.getElementById('categoryMessage').textContent = '';
      showScreen('roomScreen');
    });

    socket.on('youAreHost', () => {
      isHost = true;
      document.getElementById('hostLabel').style.display = 'block';
      document.getElementById('categorySelection').classList.remove('hidden');
    });

    socket.on('roundCancelled', (msg) => {
      alert('⚠️ ' + msg);
      showScreen('roomScreen');
      document.getElementById('startButtonDiv').classList.remove('hidden');
    });

    function updateRoomUI() {
      const list = document.getElementById('playersList');
      list.innerHTML = '';
      players.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = '👤 ' + p.name + ' <span class="score-badge">' + p.score + '</span>';
        if (p.id === socket.id) li.innerHTML += ' (أنت)';
        list.appendChild(li);
      });
      if (isHost) {
        document.getElementById('categorySelection').classList.remove('hidden');
        document.getElementById('hostLabel').style.display = 'block';
      } else {
        document.getElementById('categorySelection').classList.add('hidden');
        document.getElementById('startButtonDiv').classList.add('hidden');
        document.getElementById('hostLabel').style.display = 'none';
      }
    }
  </script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(HTML_CONTENT);
});

const categories = {
  "مشاهير": {
    common: "من هو أشهر ممثل في هوليوود؟",
    atrash: "ما هو أسرع حيوان في العالم؟"
  },
  "أكلات": {
    common: "ما هي أشهر أكلة سعودية؟",
    atrash: "كم عدد الكواكب في المجموعة الشمسية؟"
  },
  "أفلام": {
    common: "ما هو أعلى فيلم دخلاً في التاريخ؟",
    atrash: "كم عدد أرجل العنكبوت؟"
  },
  "رياضة": {
    common: "من هو أفضل لاعب كرة قدم في التاريخ؟",
    atrash: "ما هي عاصمة اليابان؟"
  },
  "حيوانات": {
    common: "ما هو أذكى حيوان في العالم؟",
    atrash: "كم عدد حروف اللغة العربية؟"
  },
  "جغرافيا": {
    common: "ما هي أكبر دولة عربية مساحةً؟",
    atrash: "ما هو لون السماء في الليل؟"
  }
};

const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('✅ متصل:', socket.id);

  socket.on('createRoom', (playerName) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      host: socket.id,
      players: [{ id: socket.id, name: playerName, score: 0 }],
      category: null,
      atrash: null,
      roundActive: false,
      votes: {},
      discussionTimer: null,
      votingTimer: null
    };
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, players: rooms[roomCode].players });
    console.log('🏠 غرفة جديدة:', roomCode);
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit('error', 'الغرفة غير موجودة');
      return;
    }
    if (room.roundActive) {
      socket.emit('error', 'الجولة بدأت، لا يمكن الانضمام الآن');
      return;
    }
    if (room.players.find(p => p.name === playerName)) {
      socket.emit('error', 'الاسم موجود مسبقاً في الغرفة');
      return;
    }
    room.players.push({ id: socket.id, name: playerName, score: 0 });
    socket.join(roomCode);
    io.to(roomCode).emit('playerJoined', room.players);
    console.log('👤 انضم للغرفة', roomCode, ':', playerName);
  });

  socket.on('selectCategory', ({ roomCode, category }) => {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id) return;
    if (!categories[category]) return;
    room.category = category;
    io.to(roomCode).emit('categorySelected', category);
    console.log('📂 فئة مختارة في', roomCode, ':', category);
  });

  socket.on('startRound', (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id) return;
    if (!room.category) {
      socket.emit('error', 'اختر فئة أولاً');
      return;
    }
    if (room.players.length < 3) {
      socket.emit('error', 'تحتاج 3 لاعبين على الأقل');
      return;
    }
    if (room.roundActive) {
      socket.emit('error', 'الجولة ما زالت نشطة');
      return;
    }

    const atrashIndex = Math.floor(Math.random() * room.players.length);
    room.atrash = room.players[atrashIndex].id;
    room.roundActive = true;
    room.votes = {};

    const cat = categories[room.category];

    room.players.forEach((player) => {
      const question = (player.id === room.atrash) ? cat.atrash : cat.common;
      io.to(player.id).emit('newRound', {
        question,
        players: room.players.map(p => ({ name: p.name, id: p.id, score: p.score }))
      });
    });

    clearTimeout(room.discussionTimer);
    room.discussionTimer = setTimeout(() => {
      if (rooms[roomCode] && rooms[roomCode].roundActive) {
        startVotingPhase(roomCode);
      }
    }, 60000);

    io.to(roomCode).emit('roundStarted', {
      message: 'تم توزيع الأسئلة، لديكم 60 ثانية للنقاش',
      players: room.players.map(p => ({ name: p.name, id: p.id, score: p.score }))
    });
    console.log('🚀 جولة بدأت في', roomCode);
  });

  socket.on('skipToVote', (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id) return;
    if (!room.roundActive) return;
    clearTimeout(room.discussionTimer);
    startVotingPhase(roomCode);
  });

  socket.on('vote', ({ roomCode, suspectId }) => {
    const room = rooms[roomCode];
    if (!room || !room.roundActive) return;
    if (room.votes[socket.id]) return;

    room.votes[socket.id] = suspectId;
    io.to(roomCode).emit('voteUpdate', Object.keys(room.votes).length, room.players.length);
    console.log('🗳️ صوت في', roomCode);

    if (Object.keys(room.votes).length === room.players.length) {
      clearTimeout(room.votingTimer);
      endRound(roomCode);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ فصل:', socket.id);
    for (const code in rooms) {
      const room = rooms[code];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.host === socket.id && room.players.length > 0) {
          room.host = room.players[0].id;
          io.to(room.players[0].id).emit('youAreHost');
        }
        io.to(code).emit('playerLeft', room.players);
        if (room.players.length === 0) {
          clearTimeout(room.discussionTimer);
          clearTimeout(room.votingTimer);
          delete rooms[code];
          console.log('🗑️ غرفة محذوفة:', code);
        } else if (room.roundActive && room.players.length < 3) {
          clearTimeout(room.discussionTimer);
          clearTimeout(room.votingTimer);
          room.roundActive = false;
          io.to(code).emit('roundCancelled', 'عدد اللاعبين غير كافٍ');
        }
        break;
      }
    }
  });
});

function startVotingPhase(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.votes = {};
  io.to(roomCode).emit('votingPhase', room.players.map(p => ({ name: p.name, id: p.id, score: p.score })));
  console.log('🗳️ مرحلة التصويت في', roomCode);
  room.votingTimer = setTimeout(() => {
    if (rooms[roomCode] && rooms[roomCode].roundActive) {
      endRound(roomCode);
    }
  }, 30000);
}

function endRound(roomCode) {
  const room = rooms[roomCode];
  if (!room || !room.roundActive) return;
  clearTimeout(room.votingTimer);
  room.roundActive = false;

  const voteCount = {};
  for (const voter in room.votes) {
    const suspect = room.votes[voter];
    voteCount[suspect] = (voteCount[suspect] || 0) + 1;
  }

  let maxVotes = 0;
  let mainSuspect = null;
  for (const id in voteCount) {
    if (voteCount[id] > maxVotes) {
      maxVotes = voteCount[id];
      mainSuspect = id;
    }
  }

  const atrashCaught = (mainSuspect === room.atrash);
  const trueAtash = room.players.find(p => p.id === room.atrash);

  if (atrashCaught) {
    for (const voter in room.votes) {
      if (room.votes[voter] === room.atrash) {
        const player = room.players.find(p => p.id === voter);
        if (player) player.score += 1;
      }
    }
  } else {
    if (trueAtash) trueAtash.score += 2;
  }

  io.to(roomCode).emit('roundResult', {
    atrash: trueAtash ? trueAtash.name : 'غير معروف',
    atrashCaught,
    players: room.players.map(p => ({ name: p.name, score: p.score, id: p.id })),
    votes: room.votes
  });
  console.log('🏁 جولة انتهت في', roomCode, atrashCaught ? '- انكشف الأطرش' : '- نجا الأطرش');

  setTimeout(() => {
    if (rooms[roomCode]) {
      io.to(roomCode).emit('readyForNewRound', rooms[roomCode].players);
    }
  }, 5000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🎮 السيرفر يعمل على: http://localhost:' + PORT);
});
