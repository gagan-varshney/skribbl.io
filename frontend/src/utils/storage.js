const PLAYER_ID_KEY = "skribbl_player_id";
const PLAYER_NAME_KEY = "skribbl_player_name";

export function getStoredPlayerId() {
  return localStorage.getItem(PLAYER_ID_KEY) || "";
}

export function setStoredPlayerId(id) {
  if (!id) return;
  localStorage.setItem(PLAYER_ID_KEY, id);
}

export function getStoredPlayerName() {
  return localStorage.getItem(PLAYER_NAME_KEY) || "";
}

export function setStoredPlayerName(name) {
  if (!name) return;
  localStorage.setItem(PLAYER_NAME_KEY, name);
}
