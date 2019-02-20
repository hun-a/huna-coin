const WebSocket = require('ws');
const sockets = [];
const startP2PServer = server => {
  const wsServer = new WebSocket.Server({ server });

  wsServer.on('connection', ws => {
    console.log(`Hello ${ws}`);
  });

  console.log(`Nomadcoin P2PServer Runnging!`);
};

module.exports = {
  startP2PServer
};