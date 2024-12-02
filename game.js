const socket = io();

function startGame() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomName = urlParams.get('room');
  const playerName = urlParams.get('name');
  const profilePath = urlParams.get('profile');
  const isLeaderParam = urlParams.get('isLeader'); // ดึงค่าจาก URL

const isLeader = isLeaderParam === 'true';// ตรวจสอบและแปลงค่า isLeader
  if (roomName && playerName && profilePath) {
    socket.emit('joinRoom', { room: roomName, name: playerName, profile: profilePath,isLeader});
  } else {
    console.error('Missing profile or player name.');
    return;
  }

  socket.on('playerUpdate', function(playersData) {
    console.log('Player data received:', playersData);
     // เพิ่ม log เพื่อตรวจสอบข้อมูลที่ได้รับ
    updatePlayersOnScreen(playersData);

  });
  

  // Listener สำหรับข้อความใหม่
  socket.on('updateMessage', ({ playerId, message }) => {
    console.log(`Message received for playerId: ${playerId} - ${message}`);
    const messageBox = document.getElementById(`message-box-${playerId}`);
    if (messageBox) {
      messageBox.innerText = message; // อัปเดตข้อความในกรอบด้านล่าง
    } else {
      console.error(`Message box for player ${playerId} not found.`);
    }
  });
}

function updatePlayersOnScreen(players) {
  if (!players) {
    console.error("No players data received.");
    return;
  }

  const slots = ["block1", "block2", "block3", "block4", "block5", "block6"];
  slots.forEach((slotId) => {
    const slot = document.getElementById(slotId);
    if (slot) slot.innerHTML = ""; // เคลียร์ข้อมูลเก่าในช่องก่อน
  });

  let index = 0;
  for (let playerId in players) {
    if (index >= slots.length) break;
    const player = players[playerId];
    const slotId = slots[index];
    const slot = document.getElementById(slotId);

    if (slot) {
      // ส่ง playerId ไปยัง displayProfile ด้วยสถานะ isDead
      displayProfile(slot, player.profile, player.name, playerId, player.isDead, player.isLeader);
    }
    index++;
  }
}

function displayProfile(slot, profilePath, playerName, playerId, isDead,isLeader) {
  const currentPlayerId = socket.id; // ID ของผู้เล่นปัจจุบัน

  if (slot && profilePath) {
    const profileImage = document.createElement('img');
    profileImage.src = profilePath;
    profileImage.className = 'profile-zone';

    const nameElement = document.createElement('p');
    nameElement.innerText = playerName;
    nameElement.className = 'player-name';

    const textBox = document.createElement('input');
    textBox.type = 'text';
    textBox.placeholder = 'Enter your message';
    textBox.className = 'profile-input';
    textBox.id = `input-box-${playerId}`;

    // Disable textBox for other players หรือผู้เล่นที่ตาย
    textBox.disabled = playerId !== currentPlayerId || isDead; 

    const profileContainer = document.createElement('div');
    profileContainer.className = 'profile-container';

    const profileBack = document.createElement('div');
    profileBack.className = 'profile-background';

    // กรอบข้อความด้านล่าง
    const messageBox = document.createElement('div');
    messageBox.id = `message-box-${playerId}`;
    messageBox.className = 'message-box'; // ใช้คลาสสำหรับสไตล์พื้นหลัง
    messageBox.innerText = isDead ? 'Dead' : 'No messages yet'; // ข้อความเริ่มต้น

    let startButton = document.getElementById('start-game-button');

    // Event listener สำหรับ textBox
    textBox.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && textBox.value.trim()) {
        socket.emit('sendMessage', {
          message: textBox.value.trim(),
          playerId: currentPlayerId,
        });
        textBox.value = ''; // ล้างข้อความในกล่อง
      }
    });

    profileBack.appendChild(profileImage);
    profileContainer.appendChild(profileBack);
    profileContainer.appendChild(textBox);
    profileContainer.appendChild(nameElement);
    profileContainer.appendChild(messageBox);

    slot.appendChild(profileContainer);
    if(isLeader){
      startButton.disabled = false;
      //startButton.disabled = false;
      const crownImage = document.createElement('img');
        crownImage.src = 'profile/crown.png'; // เส้นทางรูปมงกุฎ
        crownImage.classList.add('crown-icon');
      slot.appendChild(crownImage);
    }
  } else {
    slot.innerHTML = '<p>Error: Missing profile or player data.</p>';
  }
}

// แก้ไขการแสดงเวลานับถอยหลังและรอบ


function goBack() {
  socket.emit('leaveRoom');
  window.location.href = 'lobby.html';
}

function initializeStartButton() {
  let startButton = document.getElementById('start-game-button');
  if (!startButton) {
    // สร้างปุ่ม Start Game
    startButton = document.createElement('button');
    startButton.id = 'start-game-button';
    startButton.innerText = 'Start Game';
    startButton.disabled = true; 
    startButton.classList.add('start-game-button');
    document.body.appendChild(startButton);
    console.log('Start button created');
  }

  const urlParams = new URLSearchParams(window.location.search);
  const roomName = urlParams.get('room');

   socket.on('updateStartButton', (isEnabled) => {
    startButton.disabled = !isEnabled; // เปิดหรือปิดปุ่มตามสถานะที่ได้รับ
  });
  // แจ้งเซิร์ฟเวอร์เพื่อตรวจสอบสถานะหัวห้อง
  socket.on('leaderStatus', ({ isLeader }) => {
    startButton.disabled = !isLeader; 
  });

  // เพิ่ม Event Listener ให้ปุ่ม
  startButton.addEventListener('click', () => {
    console.log(`Start Game clicked for room: ${roomName}`);
    socket.emit('startGame', { room: roomName });
  });

  // รับสถานะจากเซิร์ฟเวอร์เพื่อเปิด/ปิดปุ่ม

  // รับการเริ่มเกมจากเซิร์ฟเวอร์
  socket.on('gameStart', (gameData) => {
    console.log('Game started:', gameData);
    assignWordsToPlayers(gameData);
  });
}

socket.on('leaderChanged', ({ leaderId }) => {
  console.log(`New leader is: ${leaderId}`);
  if (socket.id === leaderId) {
    console.log('You are the new leader!');
    document.getElementById('start-game-button').disabled = false; // เปิดใช้งานปุ่ม Start Game
  } else {
    document.getElementById('start-game-button').disabled = true; // ปิดการใช้งานปุ่ม Start Game
  }
});

function assignWordsToPlayers(gameData) {
  const { spyId, words, players } = gameData;
  const currentPlayer = players[socket.id];

  if (currentPlayer) {
    const playerWord = socket.id === spyId ? words.spy : words.agent;

    // แสดงคำในคอนเทนเนอร์ "Your Word"
    const wordContainer = document.getElementById('word-container');
    const wordDisplay = document.getElementById('your-word-display');

    if (wordContainer && wordDisplay) {
      wordDisplay.innerText = playerWord; // อัปเดตคำของเรา
      wordContainer.style.display = 'block'; // แสดงคอนเทนเนอร์
    } else {
      console.error('Word container or display element not found.');
    }
  } else {
    console.error('Player not found in the game data.');
  }
}



socket.on('roundUpdate', ({ round, duration }) => {
  if (round !== undefined && duration !== undefined) {
    // ตรวจสอบและสร้างหรืออัปเดต 'timer' element
    let timerElement = document.querySelector('.timer');
    if (!timerElement) {
      timerElement = document.createElement('div');
      timerElement.className = 'timer';
      document.body.appendChild(timerElement);
    }

    // ถ้ามี interval ที่กำลังทำงาน ให้ล้างออกก่อน
    if (window.roundInterval) {
      clearInterval(window.roundInterval);
    }

    // ตั้งค่าเวลาที่เหลือและตัวนับถอยหลัง
    let timeLeft = duration;
    timerElement.textContent = `Round ${round}: ${timeLeft} seconds remaining`;

    window.roundInterval = setInterval(() => {
      if (timeLeft > 0) {
        timerElement.textContent = `Round ${round}: ${timeLeft} seconds remaining`;
        timeLeft--;
      } else {
        clearInterval(window.roundInterval);
        // เมื่อหมดเวลารอบให้ส่งข้อความว่าหมดเวลาแล้ว
        timerElement.textContent = ``;
      }
    }, 1000);
  } else {
    console.error("Received undefined round or duration from server");
  }
});


socket.on('countdown', (timeLeft) => {
  // ตรวจสอบว่ามี .run-game หรือยัง
  
  let run = document.querySelector('.run-game');
  if (!run) {
    // ถ้ายังไม่มี ให้สร้างและเพิ่มเข้าไปใน DOM
    run = document.createElement('div');
    run.className = 'run-game';
    document.body.appendChild(run); // เพิ่มเข้าไปใน body
  }
  
  run.textContent = timeLeft; // แสดงเวลาที่เหลือ
});


socket.on('countdownFinished', (text) => {
  // ลบข้อความนับถอยหลัง
  const run = document.querySelector('.run-game');
  if (run) {
    run.textContent = ''; // เคลียร์ข้อความ
  }
  // สร้างหรืออัปเดตข้อความ "Game Started"
  let run2 = document.querySelector('.run-game2');
  if (!run2) {
    run2 = document.createElement('div');
    run2.className = 'run-game2';
    document.body.appendChild(run2); // เพิ่มเข้าไปใน body
  }

  run2.textContent = text; 
  setTimeout(() => {
    run2.textContent = ''; // ลบข้อความ "Game Started"
  }, 1000); 
});



socket.on('startRound', ({ round, duration }) => {
  const timerElement = document.querySelector('.timer');
  timerElement.textContent = `Round ${round}: ${duration} seconds remaining`;

  let timeLeft = duration;
  const interval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
          timerElement.textContent = `Round ${round}: ${timeLeft} seconds remaining`;
      } else {
          clearInterval(interval);
      }
  }, 1000);
});


// เมื่อเริ่มการโหวต
socket.on('startVoting', ({ duration, players }) => {
  const voterId = socket.id; // ID ของผู้เล่นปัจจุบัน
  const currentPlayer = players.find(player => player.id === voterId); // หา Player ปัจจุบัน

  // ถ้าผู้เล่นปัจจุบันตาย ให้ซ่อน UI โหวต
  if (currentPlayer && currentPlayer.isDead) {
    console.log("You are dead. Hiding voting UI.");
    const playerList = document.querySelector('.player-list');
    if (playerList) {
      playerList.innerHTML = ''; // ล้าง player list
      playerList.style.display = 'none'; // ซ่อน player list
    }
    return; // ออกจากฟังก์ชัน ไม่แสดง UI การโหวต
  }

  // ตั้งค่าตัวจับเวลา
  const timerElement = document.querySelector('.timer') || document.createElement('div');
  timerElement.className = 'timer';
  timerElement.textContent = `Voting phase: ${duration} seconds remaining`;
  document.body.appendChild(timerElement);

  let timeLeft = duration;
  const interval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      timerElement.textContent = `Voting phase: ${timeLeft} seconds remaining`;
    } else {
      clearInterval(interval);
      timerElement.textContent = '';

      // ซ่อน UI โหวตเมื่อจบรอบโหวต
      const playerList = document.querySelector('.player-list');
      if (playerList) {
        playerList.innerHTML = ''; // ล้าง player list
        playerList.style.display = 'none'; // ซ่อน player list
      }
    }
  }, 1000);

  // กรองผู้เล่นที่ยังมีชีวิตและไม่ใช่ตัวเอง
  const filteredPlayers = players.filter(player => player.id !== voterId && !player.isDead); // กรองผู้เล่นที่ตายแล้ว
  const playerList = document.querySelector('.player-list');

  // แสดง player list สำหรับผู้ที่ยังมีชีวิต
  playerList.innerHTML = ''; // ล้างรายการเดิม
  playerList.style.display = 'block'; // แสดง player list สำหรับผู้ที่ยังมีชีวิต

  filteredPlayers.forEach((player) => {
    const playerElement = document.createElement('button');
    playerElement.className = 'vote-button';
    playerElement.textContent = player.name;
    playerElement.addEventListener('click', () => {
      socket.emit('vote', {
        room: new URLSearchParams(window.location.search).get('room'),
        voter: socket.id,
        votedPlayer: player.id,
      });
      playerList.innerHTML = ''; // ลบปุ่มหลังโหวต
    });
    playerList.appendChild(playerElement);
  });
});





socket.on('noPlayerVotedOut', () => {
  alert('No player was voted out. Proceeding to the next round.');
});

window.onload = function () {
  const urlParams = new URLSearchParams(window.location.search);
  const isLeaderParam = urlParams.get('isLeader');
  const isLeader = isLeaderParam === 'true';
  startGame();
  initializeStartButton();
  // ซ่อนคอนเทนเนอร์ "Your Word" ตอนเริ่มต้น
  const wordContainer = document.getElementById('word-container');
  if (wordContainer) {
    wordContainer.style.display = 'none';
  }
};

socket.on('playerVotedOut', ({ player }) => {
  console.log(`${player} has been voted out.`);
});

socket.on('playerDead', ({ player }) => {
  player.isDead = true;
  const inputBox = document.querySelector(`#input-box-${player}`);
  if (inputBox) {
    inputBox.disabled = true; // Disable input
    inputBox.value = 'Eliminated!!!'; // แจ้งเตือนว่าตาย
    inputBox.style.color = "red";
  }

  const messageBox = document.getElementById(`message-box-${player}`);
  if (messageBox) {
    messageBox.innerText = 'Dead';
    messageBox.style.color = 'red';
  }
});
// เมื่อเกมจบ
socket.on('gameOver', ({ result ,room}) => {
  setTimeout(() => {
  const r= document.createElement('div');
  r.className = 'result';
  if(result=="win"){
    r.innerText = "Players win!";
  }
  else{
    r.innerText = "Spy win!";
  }
  document.body.appendChild(r);
  setTimeout(() => {
    r.remove();
  }, 8000);

}, 1500);

  let startButton = document.getElementById('start-game-button');
  startButton.disabled = false;
  
});
socket.on('resetlive', ({ players }) => {
  // วนลูปผ่านผู้เล่นทั้งหมดและรีเซ็ต UI
  const currentPlayerId = socket.id;
  Object.keys(players).forEach((playerId) => {
    const inputBox = document.querySelector(`#input-box-${playerId}`);
    const messageBox = document.getElementById(`message-box-${playerId}`);

    if (inputBox) {
      inputBox.disabled = playerId !== currentPlayerId;
      if (playerId === currentPlayerId) {
        inputBox.value = ''; // ล้างข้อความ
        inputBox.placeholder = 'Enter your message'; // แสดงคำแนะนำเริ่มต้น
      }
      if(inputBox.value == 'Eliminated!!!'){
        inputBox.value="Enter your message";
        inputBox.style.color = "black";
      }
    }

    if (messageBox) {
      messageBox.innerText = 'No messages yet'; // รีเซ็ตข้อความ
      messageBox.style.color = 'black'; // เปลี่ยนสีข้อความเป็นปกติ
    }
  });
});

socket.on('crowm', ({ crown, room, player }) => {
  const playerElement = document.getElementById(`player-${player}`); // ใช้ ID ของผู้เล่นเพื่ออ้างอิง DOM

  if (playerElement) {
    // สร้างองค์ประกอบสำหรับมงกุฎ
    const crownImage = document.createElement('img');
    crownImage.src = crown; // ใช้ URL ที่เซิร์ฟเวอร์ส่งมา
    crownImage.alt = 'Leader Crown';
    crownImage.classList.add('crown-icon');

    // เพิ่มมงกุฎที่มุมซ้ายบนของโปรไฟล์
    playerElement.appendChild(crownImage);
  }
});






