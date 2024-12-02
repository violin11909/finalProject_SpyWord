function proceedToProfileSelection() {
  const playerName = document.getElementById('player-name').value.trim();
  if (playerName === '') {
    alert('Please enter your name!');
    return;
  }

  sessionStorage.setItem('playerName', playerName);
  document.getElementById('name-input').style.display = 'none';
  document.getElementById('profiles').style.display = 'block';
}

function redirectToLobby(profilePath) {
  const playerName = sessionStorage.getItem('playerName');
  if (!playerName) {
    alert('Please enter a name first!');
    return;
  }

  sessionStorage.setItem('profilePath', profilePath);
  window.location.href = 'lobby.html';
}

function showProfileSelection() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('profile-selection').style.display = 'flex';
}
