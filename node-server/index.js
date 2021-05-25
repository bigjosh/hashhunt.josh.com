const port = 80;  // Port to listen for connections on
const express = require('express');     // Webserver
const app = express();

// Next set up ws to handle the WebSockets
// https://www.npmjs.com/package/express-ws
// Seems like we must do this first before adding other `use`s.
const ws = require('express-ws') (app);

app.use(express.static( 'express_static'));          // Serve static files from folder. https://expressjs.com/en/starter/static-files.html

app.ws('/', function(ws, req) {
    ws.on('message', function(msg) {
        console.log("msg:"+msg);
    });
    ws.on('open', function() {
        console.log("open");
    });
});

const express_server = app.listen( {port: port} );


// Connect ws to handle the websocket upgrade event



// wss.on('connection', function connection(ws) {
//     ws.on('message', function incoming(data) {
//         console.log( "got:" + data );
//         wss.clients.forEach(function each(client) {
//             if (client.readyState === ws.OPEN) {
//                 client.send(data);
//             }
//         })
//     })
// })

