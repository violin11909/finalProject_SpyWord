require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// connect to mongo
const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri, {
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});



const wordSchema = new mongoose.Schema({
  // id: Number,
  name: String,
  category: String
});

const Word = mongoose.model('Word', wordSchema);

app.use(express.static(__dirname));

server.listen(3000, '0.0.0.0', () => {
  console.log('Server running on port 3000');
});




let rooms = {};
const MAX_ROUNDS = 5; // จำนวนรอบสูงสุด
let gameState = {};

function updateRoomPlayerCount(roomName) {
  if (rooms[roomName]) {
    const playerCount = Object.keys(rooms[roomName].players).length;
    const isEnabled = playerCount >= 3;
    Object.entries(rooms[roomName].players).forEach(([socketId, player]) => {
      io.to(socketId).emit('updateStartButton', player.isLeader && isEnabled); // ปิดปุ่มสำหรับคนที่ไม่ใช่ Leader
    });
    console.log(`Room: ${roomName}, Player Count: ${playerCount}, Start Button Enabled: ${isEnabled}`);
  } else {
    console.log(`Room ${roomName} does not exist.`);
  }
}


function checkAndDeleteEmptyRoom(roomName) {
  if (rooms[roomName] && Object.keys(rooms[roomName].players).length === 0) {
    setTimeout(() => {
      if (rooms[roomName] && Object.keys(rooms[roomName].players).length === 0) {
        delete rooms[roomName];
        console.log(`Room deleted: ${roomName}`);
        io.emit('roomList', rooms);
      }
    }, 500);
  }
}

io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);
  socket.on('getRooms', () => {
    socket.emit('roomList', rooms);
  });
  socket.on('getCategories', async () => {
    console.log("getCategories event received from client");
    try {
      const categories = await Word.distinct('category');
      console.log("Fetched categories:", categories);
      socket.emit('categoriesList', categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      socket.emit('errorMessage', 'Failed to fetch categories.');
    }
  });
  socket.on('checkLeader', ({ room }) => {
    if (!rooms[room]) {
      socket.emit('errorMessage', 'Room does not exist');
      return;
    }
    const isLeader = rooms[room].players[socket.id]?.isLeader || false; // ตรวจสอบสถานะ isLeader
    socket.emit('leaderStatus', { isLeader }); // ส่งสถานะกลับไปยังไคลเอนต์
  });
  
  socket.on('resetGame', ({ room }) => {
    console.log(`Reset game requested for room: ${room}`);
    resetGame(room); 
  });

  socket.on('createRoom', (roomData) => {
    const { roomName, playerName, profilePath, category } = roomData;
  
    if (rooms[roomName]) {
      socket.emit('errorMessage', 'Room already exists');
    } else {
      rooms[roomName] = { 
        players: {}, 
        category: category || "all"  // ใช้หมวดหมู่ที่เลือกหรือ default "all"
      };
      rooms[roomName].players[socket.id] = { 
        name: playerName, 
        profile: profilePath,
        isLeader: true // กำหนดผู้เล่นคนนี้เป็นผู้นำ
      };
      socket.join(roomName);
      console.log(`Room created: ${roomName} by player ${playerName} with category: ${category || "all"}`);

      io.emit('roomList', rooms);
      io.to(roomName).emit('playerUpdate', rooms[roomName].players);
      socket.emit('roomJoined', { room: roomName, name: playerName, profile: profilePath ,isLeader: true});
    }
  });
  
  

  // ให้ผู้เล่นเข้าร่วมห้องที่เลือก
  socket.on('joinRoom', (data) => {
    const { room, name, profile,isLeader } = data;
  
    if (rooms[room]) {
      rooms[room].players[socket.id] = { 
        name, 
        profile, 
        isDead: false, // สถานะสำหรับการตายในเกม
        isLeader // ไม่ใช่ผู้นำ
      };
      socket.join(room);
      console.log(`Player ${name} joined room: ${room}`);
      io.to(room).emit('playerUpdate', rooms[room].players); // ส่งข้อมูลผู้เล่นให้ทุกคนในห้อง
      console.log('Updated players:', rooms[room].players); // เพิ่ม log เพื่อตรวจสอบข้อมูลผู้เล่น
      updateRoomPlayerCount(room); // อัปเดตปุ่ม Start Game
    } else {
      socket.emit('errorMessage', 'Room does not exist');
    }
});
  
  

  // ผู้เล่นออกจากห้อง
  socket.on('leaveRoom', () => {
    for (let roomName in rooms) {
      if (rooms[roomName].players[socket.id]) {
        const wasLeader = rooms[roomName].players[socket.id].isLeader;
        delete rooms[roomName].players[socket.id];
  
        if (wasLeader) {
          // สุ่มผู้เล่นใหม่ให้เป็นหัวห้อง
          const remainingPlayers = Object.keys(rooms[roomName].players);
  
          if (remainingPlayers.length > 0) {
            const newLeaderId = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
            rooms[roomName].players[newLeaderId].isLeader = true; // กำหนดสถานะหัวห้อง
            console.log(`New leader assigned in room ${roomName}: ${newLeaderId}`);
            io.to(roomName).emit('leaderChanged', { leaderId: newLeaderId }); // แจ้งไคลเอนต์เกี่ยวกับหัวห้องใหม่
          } else {
            console.log(`Room ${roomName} is empty. No leader assigned.`);
          }
        }

        io.to(roomName).emit('playerUpdate', rooms[roomName].players);
        io.emit('roomList', rooms);
        console.log('Calling updateRoomPlayerCount after leave...');
        updateRoomPlayerCount(roomName);
  
        checkAndDeleteEmptyRoom(roomName);
        break;
      }
    }
  });

  // ผู้เล่นตัดการเชื่อมต่อ
  socket.on('disconnect', () => {
    for (let roomName in rooms) {
      if (rooms[roomName].players[socket.id]) {
        delete rooms[roomName].players[socket.id];

        io.to(roomName).emit('playerUpdate', rooms[roomName].players);
        io.emit('roomList', rooms);

        // ตรวจสอบและลบห้องถ้าไม่มีผู้เล่นเหลือ
        checkAndDeleteEmptyRoom(roomName);
        break;
      }
    }
  });

socket.on('startGame', async ({ room }) => {
  console.log(`Start Game requested for room: ${room}`);
  if (!rooms[room]) {
    console.log(`Room ${room} does not exist.`);
    socket.emit('errorMessage', 'Room does not exist');
    return;
  }

  if (rooms[room].isGameStarted) {
    socket.emit('errorMessage', 'Game has already started');
    return;
  }

  const players = Object.keys(rooms[room].players);
  if (players.length < 3) {
    console.log(`Room ${room} does not have enough players: ${players.length}`);
    socket.emit('errorMessage', 'At least 3 players are required to start the game');
    return;
  }

  rooms[room].isGameStarted = true;
  io.to(room).emit('updateStartButton', false);
  const spyIndex = Math.floor(Math.random() * players.length);
  const spyId = players[spyIndex];

  gameState[room] = {
    players,
    spy: spyId,
    round: 1,
    votes: {},
  };

  console.log(`Starting game in room ${room}. Spy: ${spyId}`);
  Start(room, 3, "Game Started!");

  setTimeout(async () => {
    try {
      const category = rooms[room].category;
      let words;

      if (category && category !== "all") {
        words = await Word.aggregate([
          { $match: { category: category } },
          { $sample: { size: 2 } }
        ]);
      } else {
        words = await Word.aggregate([{ $sample: { size: 2 } }]);
      }

      if (words.length < 2) {
        socket.emit('errorMessage', 'Not enough words available in the category');
        return;
      }

      const [word1, word2] = words;
      const spyWord = word1.name;
      const agentWord = word2.name;

      io.to(room).emit('gameStart', {
        spyId,
        words: {
          agent: agentWord,
          spy: spyWord,
        },
        players: rooms[room].players,
      });

      startGameRound(room);
    } catch (error) {
      console.error('Error fetching words from MongoDB:', error);
      socket.emit('errorMessage', 'Error fetching words from database');
    }
  }, 4000);
});


  //for create new word
  socket.on('createNewWord', async (data) => {
    const { name, category } = data;

    if (!name || !category) {
      socket.emit('errorCreatingWord', 'Please provide both word and category.');
      return;
    }

    try {
      // สร้างคำศัพท์ใหม่
      const newWord = new Word({ name, category });
      await newWord.save();
      console.log(`New word added: ${name} in category ${category}`);
      socket.emit('wordCreated', 'Word added successfully.');
    } catch (err) {
      console.error('Error adding word:', err);
      socket.emit('errorCreatingWord', 'Failed to add word.');
    }
  });

  

  socket.on('updatePlayerCount', (room) => {
    updateRoomPlayerCount(room);
  });
  
  socket.on('sendMessage', ({ message, playerId }) => {
    console.log(`Received message from playerId: ${playerId}, message: "${message}"`);

    for (let roomName in rooms) {
      if (rooms[roomName].players[playerId]) {
        console.log(`Broadcasting message to room: ${roomName}`);
        io.to(roomName).emit('updateMessage', { playerId, message });
        break;
      }
    }
  });

  const countdownToStart = (room, duration, round,text) => {
    let timeLeft = duration;
  
    const interval = setInterval(() => {
      if (timeLeft > 0) {
        // ส่งข้อมูลแยกสำหรับรอบและเวลาไปยังไคลเอนต์
        io.to(room).emit('roundUpdate', { round: round, duration: timeLeft }); // แก้ไขตรงนี้เพื่อส่งข้อมูลที่ถูกต้อง
        console.log(`Room ${room}: Countdown ${timeLeft}`);
        timeLeft--;
      } else {
        clearInterval(interval);
        console.log(`Room ${room}: Countdown finished`);
        io.to(room).emit('countdownFinished', text);
      }
    }, 1000);
  };


  
const startGameRound = (room) => {
  const currentRound = gameState[room].round;

  console.log(`Room ${room}: Starting round ${currentRound}`);

  // เช็คว่ามีผู้เล่นที่ตาย
  const alivePlayers = Object.keys(rooms[room].players).filter(
    playerId => !rooms[room].players[playerId].isDead
  );

  if (alivePlayers.length <= 2) {
    rooms[room].isGameStarted = false;
    io.to(room).emit('gameOver', { result: 'spyWin',room}); // Spy ชนะถ้าเหลือ 2 คน
    resetlive(room);
    delete gameState[room];
    return;
  }

  //io.to(room).emit('startRound', { round: currentRound, duration: 20 });
  setTimeout(() => {
    Start(room, 0,`Round ${currentRound}`); // เปลี่ยนจาก 30 เป็น 20
  }, 1000);
  setTimeout(() => {
    countdownToStart(room, 20, currentRound,`Round ${currentRound} has ended`);  /////////////////////////////////
    setTimeout(() => { // เปลี่ยนจาก 30 เป็น 20
      countdownToStart(room, 0, currentRound,`Start Voting`);
    }, 22000);
  }, 2000);
  

  setTimeout(() => {
    startVotingPhase(room);
  }, 26000); // เปลี่ยนจาก 32000 เป็น 22000 (20 วินาที + delay)
};


const startVotingPhase = (room) => {
  console.log(`Room ${room}: Starting voting phase`);
  const currentRound = gameState[room]?.round || 1;
  if (!rooms[room] || !rooms[room].players) {
    console.error(`Room ${room} or players data not found.`);
    return;
  }

  // Get list of players who are alive
  const alivePlayers = Object.keys(rooms[room].players).filter(
    playerId => !rooms[room].players[playerId].isDead
  );

  // Prepare voting data
  const votingOptions = alivePlayers.map(playerId => ({
    id: playerId,
    name: rooms[room].players[playerId].name,
    isDead: rooms[room].players[playerId].isDead
  }));

  // Broadcast voting options to the room, but include all players' information
  io.to(room).emit('startVoting', {
    duration: 15,
    players: Object.keys(rooms[room].players).map(playerId => ({
      id: playerId,
      name: rooms[room].players[playerId].name,
      isDead: rooms[room].players[playerId].isDead
    })), // ส่งข้อมูลผู้เล่นทั้งหมด
    votingOptions // ส่งเฉพาะผู้เล่นที่สามารถถูกโหวต
  });

  console.log("Voting players data:", votingOptions);
  setTimeout(() => {
    countdownToStart(room, 0, currentRound, `Voting has ended`);
  }, 15500);

  setTimeout(() => {
    processVotingResults(room);
  }, 17000); // 15 seconds + delay
};


const processVotingResults = (room) => {
  if (!gameState[room]) {
    console.error("Game state not found for room:", room);
    return;
  }

  const votes = gameState[room].votes;
  const voteCounts = {};

  // นับคะแนนโหวต
  for (const voter in votes) {
    const votedPlayer = votes[voter];
    voteCounts[votedPlayer] = (voteCounts[votedPlayer] || 0) + 1;
  }

  // ค้นหาผู้เล่นที่ได้คะแนนโหวตสูงสุด
  const maxVotes = Math.max(...Object.values(voteCounts));
  const votedOut = Object.keys(voteCounts).filter(
    (player) => voteCounts[player] === maxVotes
  );

  // กรณีคะแนนเท่ากัน ไม่มีใครถูกโหวตออก
  if (votedOut.length > 1) {
    console.log("Tie in votes, no player will be voted out.");
    io.to(room).emit('noPlayerVotedOut');
  } 
  // กรณีมีผู้เล่นที่ได้คะแนนโหวตสูงสุดแค่คนเดียว ให้ผู้เล่นคนนั้นโดนโหวตออก
  else if (votedOut.length === 1) {
    const playerOut = votedOut[0];
    console.log(`Player ${playerOut} is voted out with ${maxVotes} votes.`);
    handlePlayerVotedOut(room, playerOut);
  } 
  // ในกรณีที่ไม่มีใครได้รับคะแนนโหวต (ควรจะไม่เกิดขึ้นในเกมปกติ)
  else {
    console.log("No votes recorded, proceeding to the next round.");
    io.to(room).emit('noPlayerVotedOut');
  }

  // เพิ่มการตรวจสอบ gameState[room] ก่อนเข้าถึง round
  if (gameState[room] && !gameState[room].spyIsOut) {
    gameState[room].round++;
    if (gameState[room].round > MAX_ROUNDS) {
      io.to(room).emit('gameOver', { result: 'spyWin' ,room});
      rooms[room].isGameStarted = false;
      resetlive(room);
      delete gameState[room];
    } else {
      startGameRound(room);
    }
  }
};


const handlePlayerVotedOut = (room, playerOut) => {
  io.to(room).emit('playerVotedOut', { player: playerOut });

  // ถ้าผู้เล่นที่ถูกโหวตออกคือ Spy
  if (playerOut === gameState[room].spy) {
    io.to(room).emit('gameOver', { result: 'win' ,room}); // Agents win
    rooms[room].isGameStarted = false;
    resetlive(room);
    gameState[room].spyIsOut = true;
    // ลบ gameState[room] หลังจากส่งผลลัพธ์เกมให้กับผู้เล่นแล้ว
    delete gameState[room];
    return;
  }

  // ถ้าไม่ใช่ Spy ให้ดำเนินเกมต่อ
  rooms[room].players[playerOut].isDead = true; // เพิ่มสถานะตาย
  io.to(room).emit('playerDead', { player: playerOut });

  // ตรวจสอบจำนวนผู้เล่นที่ยังมีชีวิต
  const alivePlayers = Object.keys(rooms[room].players).filter(
    (playerId) => !rooms[room].players[playerId].isDead
  );

  // ถ้าเหลือ 2 คน และ Spy ยังอยู่ Spy ชนะ
  if (alivePlayers.length === 2) {
    rooms[room].isGameStarted = false;
    io.to(room).emit('gameOver', { result: 'spyWin' ,room});
    resetlive(room);
    delete gameState[room];
    return;
  }
};



// รับการโหวตจากผู้เล่น
socket.on('vote', ({ room, voter, votedPlayer }) => {
  if (!gameState[room]) return;

  // ตรวจสอบว่าผู้เล่นที่ส่งโหวตยังมีชีวิตอยู่
  if (rooms[room].players[voter]?.isDead) {
    console.log(`Player ${voter} is dead and cannot vote.`);
    socket.emit('errorMessage', 'You are dead and cannot vote.');
    return;
  }

  // บันทึกการโหวต
  gameState[room].votes[voter] = votedPlayer;
  console.log(`Room ${room}: ${voter} voted for ${votedPlayer}`);
});

  
});


const Start = (room, duration, text) => {
  let timeLeft = duration; // ระยะเวลานับถอยหลัง (เช่น 3 วินาที)

  const interval = setInterval(() => {
      if (timeLeft > 0) {
          // ส่งเวลาไปยังไคลเอนต์ในห้อง
          io.to(room).emit('countdown', timeLeft);
          console.log(`Room ${room}: Countdown ${timeLeft}`);
          timeLeft--;
      } else {
          clearInterval(interval); // หยุดการนับถอยหลัง
          console.log(`Room ${room}: Countdown finished`);
          io.to(room).emit('countdownFinished',text); // แจ้งไคลเอนต์ว่าการนับถอยหลังเสร็จสิ้น
      }
  }, 1000); // นับถอยหลังทุก 1 วินาที
};

const resetGame = (room) => {
  if (rooms[room]) {
    // รีเซ็ตสถานะของผู้เล่นในห้อง
    Object.keys(rooms[room].players).forEach((playerId) => {
      rooms[room].players[playerId].isDead = false; // คืนสถานะผู้เล่นให้มีชีวิต
    });

    // รีเซ็ตสถานะเกม
    rooms[room].isGameStarted = false; // อนุญาตให้กด Start Game ได้ใหม่
    delete gameState[room]; // ลบสถานะเกมใน gameState

    console.log(`Room ${room}: Game has been reset.`);
  }
};
const resetlive = (room) => {
  if (rooms[room] && rooms[room].players) {
    Object.values(rooms[room].players).forEach((player) => {
      if(player.isDead){
        player.isDead = false; 
      }
    });
    updateRoomPlayerCount(room);
    io.to(room).emit('resetlive', { players: rooms[room].players });
  } 
};


