const WebSocket = require('ws');

const port = 80;
const wss = new WebSocket.Server( { port: port } );

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(data) {
        console.log( "got:" + data );
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        })
    })
})
