const websocketPort = 80;  // Port to listen for connections on
const httpPort = 81;       // Used to let bitcoind contact use on blocknotify events

const blockSubmitCommandTemplate = "bitcoin-cli.exe submitblock ${block}";  // Passed to exec to submit a found block

const buffer = require('buffer');

const lastHash = buffer.Buffer.from( "00000000000000000008c3fcd3a46bb1beb39dc8bdbad546d595e0b7d665fd20" , "hex" );
let nbits = 0x170b3ce9;
let lastblockTimeSecs = Date.now()/1000;        // Now is UTC in ms.
let blockHeight = 1976988;

// Biolerplate from https://www.npmjs.com/package/ws#simple-server

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port:websocketPort });

// returns a buffer with the info a new connections needs to start up
// 32 bytes - previous hash
// 4 bytes - nbits (difficulty)
// 2 bytes - including seconds since last block

function startupinfo() {
    const nowSecs = Date.now()/1000;
    const b = buffer.Buffer.alloc( 2 + 4 + 32);
    b.writeUInt32LE( nowSecs , 0 );
    b.writeUInt32LE( blockHeight , 4 );
    lastHash.copy( b , 4+4 );                 // So ugly. Where is my b.writeBuffer() ?
    b.writeUInt32LE( nbits , 4+4+32 );
    b.writeUInt16LE(  nowSecs - lastblockTimeSecs , 4+4+32+4 );
    return b;
}

// Submit a block to the local bitcoind using the cli

function submitblock( b ) {
    const commandline = blockSubmitCommandTemplate.replace( "${block}" , b.toString("hex") );
    console.log("Submitting block command:"+commandline);
}

// New websocket connection - send startup info: time of last block, prev hash, target
wss.on('connection', function connection(ws) {
    ws
    ws.send( startupinfo() );
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
        submitblock(message);
    });
});

// Set up an HTTP server so we can get async notifications and share some
// diagnostics.

const http = require('http');
var url = require('url');

http.createServer(function (req, res) {
    res.write('Hello World!\r'); //write a response to the client
    // https://nodejs.org/api/url.html
    // We must supply a base here or else URL will fail with "INVALID_URL" if request doesn't use host header. So stupid.
    // https://stackoverflow.com/questions/48196706/new-url-whatwg-url-api
    const myURL = new URL( req.url , "http://stupid.com");
    const blockhash=myURL.searchParams.get("blockhash");
    const diff=myURL.searchParams.get("diff");
    console.log("diff:"+diff+"\r");
    res.write('blockhash:'+blockhash+'\r');
//    res.write('diff:'+diff+'\r');
//    res.write('target:'+diffToTarget(25046487590083.27) +'\r');
//    res.write('target:'+diffToTarget(diff) +'\r');
    res.end();
}).listen( httpPort );



// Whenever bitcoin-core gets a new block, then calls the `blocknotify` batch file, which then makes
// a `curl` call to us with the new blockhash and difficulty.

// TODO: TO submit a block via CLI https://medium.com/stackfame/how-to-run-shell-script-file-or-command-using-nodejs-b9f2455cb6b7

function blockNotify( blockhash , diff ) {

    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}