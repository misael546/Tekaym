export const GAME_VERSION='V1';
export const GAME_NAME='Tekaym Online';
export const SERVER_URL='wss://tekaym-online-server.YOUR-SUBDOMAIN.workers.dev/ws';
export const HTTP_SERVER_URL=SERVER_URL.replace(/^wss:/,'https:').replace(/^ws:/,'http:').replace(/\/ws$/,'');
export const WORLD={maxPlayers:16};
