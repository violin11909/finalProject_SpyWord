const socket = io();

// เรียกห้องเมื่อโหลดหน้าจอ
window.onload = function() {
  refreshRooms();
  loadCategories(); // ตรวจสอบว่าเรียกฟังก์ชันนี้หรือไม่
};


//catalog

function loadCategories() {
  console.log("Requesting categories from server...");
  socket.emit('getCategories');
}

//เรียก refresh 
document.getElementById('category-select').addEventListener('change', () => {
  refreshRooms(); // เรียกอัปเดตห้องใหม่ เมื่อมีการเปลี่ยนหมวดหมู่
});


// เมื่อได้รับหมวดหมู่จาก server
socket.on('categoriesList', (categories) => {
  console.log("Received categories:", categories);
  const categorySelect = document.getElementById('category-select');
  if (!categorySelect) {
    console.error("Category select element not found in DOM.");
    return;
  }
  categorySelect.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
  console.log("Categories loaded into select");
});


function createRoom() {
  const roomName = prompt('Enter room name:');
  const playerName = sessionStorage.getItem('playerName');
  const profilePath = sessionStorage.getItem('profilePath');
  const categorySelect = document.getElementById('category-select');

  if (!categorySelect) {
    console.error('Category select element not found in DOM.');
    return; // หยุดการทำงานถ้าไม่มี category select element
  }

  const selectedCategory = categorySelect.value;

  if (roomName && playerName && profilePath) {
    socket.emit('createRoom', {
      roomName: roomName,
      playerName: playerName,
      profilePath: profilePath,
      category: selectedCategory
    });
  } else {
    alert('Please enter your name and select a profile before creating a room.');
  }
}




// รีเฟรชรายการห้อง
function refreshRooms() {
  console.log("Refreshing rooms...");
  socket.emit("getRooms");
}

// เข้าร่วมห้อง
function joinRoom(roomName) {
  const playerName = sessionStorage.getItem('playerName');
  const profilePath = sessionStorage.getItem('profilePath');

  if (playerName && profilePath) {
    window.location.href = `game.html?room=${roomName}&name=${playerName}&profile=${profilePath}`;
  } else {
    alert('Please enter a name and select a profile before joining a room.');
  }
}



socket.on("roomList", (rooms) => {
  console.log("Received room list:", rooms);

  const roomListElement = document.getElementById("room-list");
  if (!roomListElement) {
    console.error("Element with id 'room-list' not found.");
    return;
  }

  // ล้างรายการห้องเก่า
  roomListElement.innerHTML = "";

  // ตรวจสอบหมวดหมู่ที่เลือก
  const selectedCategory = document.getElementById('category-select').value;

  // กรองห้องตามหมวดหมู่ที่เลือก
  const filteredRooms = Object.keys(rooms).filter((roomName) => {
    const room = rooms[roomName];
    return selectedCategory === "all" || room.category === selectedCategory;
  });

  // ถ้าไม่มีห้องที่ตรงกับหมวดหมู่ ให้แสดงข้อความ "No rooms available."
  if (filteredRooms.length === 0) {
    roomListElement.innerHTML = "<p>No rooms available.</p>";
    return;
  }

  // แสดงห้องที่ตรงกับหมวดหมู่ที่เลือก
  filteredRooms.forEach((roomName) => {
    const room = rooms[roomName];
    const isGameStarted = room.isGameStarted; // ตรวจสอบสถานะห้อง
    const roomItem = document.createElement("div");
    roomItem.className = "room-item";

    roomItem.innerHTML = `
      <span>${roomName} (${Object.keys(room.players).length} / 6)</span>
      <button class="button" onclick="${isGameStarted ? `alert('Game is already started. You cannot join this room.')` : `joinRoom('${roomName}')`}" ${isGameStarted ? 'disabled' : ''}>
        ${isGameStarted ? 'Is Playing' : 'Join Room'}
      </button>
    `;
    roomListElement.appendChild(roomItem);
  });
});

// เมื่อห้องถูกสร้างและผู้สร้างต้องไปที่ game.html ทันที
socket.on('roomJoined', (data) => {
  const { room, name, profile,isLeader} = data;
  window.location.href = `game.html?room=${room}&name=${name}&profile=${profile}&isLeader=${isLeader}`;
});

// เมื่อมีห้องถูกสร้างใหม่
socket.on('roomCreated', () => {
  refreshRooms();
});

// เมื่อมีข้อผิดพลาด
socket.on('errorMessage', (message) => {
  alert(message);
});

window.onload = function() {
  refreshRooms(); // เรียกอัปเดตห้องทันที
  setInterval(refreshRooms, 5000); // ตั้งให้อัปเดตอัตโนมัติ
};

socket.on('getRooms', () => {
  socket.emit('roomList', rooms); // ส่งรายการห้องปัจจุบัน
});

function goBacktoIndex() {
  const playerName = sessionStorage.getItem('playerName');
  const profilePath = sessionStorage.getItem('profilePath');

  // Notify the server about explicit disconnection
  // Clear session storage
  sessionStorage.removeItem('playerName');
  sessionStorage.removeItem('profilePath');

  // Redirect to index.html
  window.location.href = 'index.html';
}

// ฟังก์ชันสำหรับเปิด Prompt เพื่อรับคำศัพท์และหมวดหมู่
function openCreateWordPrompt() {
  const word = prompt('Enter the word:');
  const category = prompt('Enter the category:');

  if (word && category) {
    // ส่งข้อมูลคำศัพท์ไปยังเซิร์ฟเวอร์
    socket.emit('createNewWord', {
      name: word,
      category: category
    });
  } else {
    alert('Please provide both word and category.');
  }
}

// เมื่อเซิร์ฟเวอร์ตอบกลับการเพิ่มคำศัพท์
socket.on('wordCreated', (message) => {
  alert(message);
});

// เมื่อมีข้อผิดพลาดในการเพิ่มคำศัพท์
socket.on('errorCreatingWord', (message) => {
  alert('Error: ' + message);
});
