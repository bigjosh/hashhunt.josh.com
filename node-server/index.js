const websocketPort = 80;  // Port to listen for websocket connections from clients
const httpPort = 81;       // Used to let bitcoind `blocknotify` tell us about new blocks

const blockSubmitCommandTemplate = "bitcoin-cli.exe submitblock ${block}";  // Passed to exec to submit a found block

let lastBlockBuffer = Buffer.alloc(256);    // Keep a prefilled buffer around so we can quickly update and send it. Make it way too big here and know about lengths in the code below.
let lastBlockTimeSecs =0;                   // Time current round started. Updated in update buffer functions.
setDefaultLastBlockBuffer(lastBlockBuffer); // Put some dummy data in the buffer until we get an update.

// We need to lift this to global scope so we can get to the OPEN static constant
const WebSocket = require('ws');

console.log("Starting websocket server on port "+websocketPort+"...");
const wss = startWebsocketServer( websocketPort );
console.log("Starting http server on port "+httpPort+"...");
const httpServer = startHttpServer(httpPort);

// Biolerplate from https://www.npmjs.com/package/ws#simple-server

function startWebsocketServer( websocketPort ) {

    const wss = new WebSocket.Server({ port:websocketPort });

    // New websocket connection - send startup info: time of last block, prev hash, target
    wss.on('connection', function connection(ws,req) {

        // https://stackoverflow.com/questions/14822708/how-to-get-client-ip-address-with-websocket-websockets-ws-library-in-node-js
        console.log( "New ws connection from: " + ws._socket.remoteAddress)

        starupNewWsConnection( ws , lastBlockBuffer );

        ws.on('message', function incoming(message) {
            // For now the only thing we recieve from the client is a mined block, which we turn around and submit.
            console.log('received: %s', message);

            if (isBlockValid(message)) {
                submitblock(message);
                ws.send('A');       // Send accept reciept back to the client.
            } else {
                ws.send('J');       // Send reject reciept back to the client. (Anything but A is reject for now)
            }
        });
    });

    return wss;

}

// Checks that a block is valid so we don't waste effort submitting bad blocks to bitcoin-core since
// it is expensive. Check...
// length is right
// nbits is right
// height is right
// coinbase has hashhunt data in it
// hash is below target

function isBlockValid(b) {
    // TODO: write this
    return true;        // (for now)
}

// **** We use this buffer to send updates to the clients over the websocket.
// We do not always need to update all of the info, so fields are in order so that
// least often updated is at the end. This way we can send a partial buffer to do partial
// updates and the client can tell how much to update by the length of the message.

// Just set up an old block so there is something to send to new clients who connect before we
// get the first block....

function  setDefaultLastBlockBuffer(b) {
    // Info about the last block we know about. Default to this nice block from 5/26/21 until we get next notify
    let lastBlockHash       = Buffer.from( "00000000000000000008c3fcd3a46bb1beb39dc8bdbad546d595e0b7d665fd20" , "hex" );
    let lastBlocknbits      = 0x170b3ce9;
    let lastblockTimeSecs   = 1622081307;        // Now is UTC in ms.
    let lastBlockHeight     = 685096;
    updateLastBlockBufferAdjust(b,lastblockTimeSecs,lastBlockHeight,lastBlockHash,lastBlocknbits);
}

// Update a new block without difficulty adjustment

function updateLastBlockBuffer( b , nowSecs,  height  , prevHash ) {

    lastBlockTimeSecs = Date.now()/1000;        // Time current round started

    b.writeUInt32LE(nowSecs, 0);
    b.writeUInt32LE(height, 4);
    prevHash.copy(b, 4 + 4);                    // Note we send in BE and let the client reverse it since it takes work and they already have the function to do so.

    return b.slice( 0 , 4+4+32 );           // Return a pre-sized buffer
}

// Update a new block with difficulty adjustment (every 2016 blocks)

function updateLastBlockBufferAdjust( b , nowSecs, height , prevHash ,  nbits  ) {
    updateLastBlockBuffer( b , nowSecs , height , prevHash );
    b.writeUInt32LE( nbits , 4+4+32 );
    return b.slice( 0 , 4+4+32 + 4);                    // Return a pre-sized buffer
}

// Uses current time and the timestamp of last block to update the "delay time" field  which is only used
// on the initial send to a new client connection. This is so the client can estimate how long the current
// round has been going on for.

function updateLastBlockBufferDelay(b) {

    const nowSecs = Date.now()/1000;    // milliseconds to seconds
    const delaySecs = Math.min( nowSecs - lastBlockTimeSecs , 0xffff);    // Make sure fits in 16 bits

    b.writeUInt16LE(  delaySecs , 4+4+32+4 );
    return b.slice( 0 , 4+4+32+4 + 2);                    // Return a pre-sized buffer
}


// Submit a block to the local bitcoind using the cli

function submitblock( b ) {

    // Run a batch file to submit the block to bitcoin core over RPC
    const commandline = blockSubmitCommandTemplate.replace( "${block}" , b.toString("hex") );
    console.log("Submitting block command:"+commandline);


}

// Set up an HTTP server so we can get async notifications and share some
// diagnostics. Returns

var count=0;

function startHttpServer(port) {

    const http = require('http');
    var url = require('url');

    const httpServer = http.createServer(function (req, res) {

        // https://nodejs.org/en/knowledge/HTTP/clients/how-to-access-query-string-parameters/
        const pathname = url.parse(req.url,true).pathname;
        const queryObject = url.parse(req.url,true).query;

        console.log("req.url:"+req.url);

        if (pathname.startsWith("/blocknotify")) {

            // https://www.pabbly.com/tutorials/node-js-http-server-handling-get-and-post-request/
            if (req.method === "GET") {

                // For GET, use URL params
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end('Blocknotify good, thank you.');

                const blockhash = Buffer.from(queryObject.blockhash, "hex");          // We keep and send in BE format becuase easier to reverse on the client.
                const nbits = queryObject.nbits;
                const height = queryObject.height;

                console.log("blocknotify GET blockhash=" + blockhash.toString("hex") + " nbits=" + nbits.toString(16) + " height=" + height);

                // No param sanity checks here. We should be the only ones able to submit, so want to crash if any problems.
                blockNotify(blockhash, nbits, height, lastBlockBuffer);       // Send update to clients
            } else {

                // For POST we will parse bitcoin-core JSON output for GETBLOCK command

                var body = "";
                req.on('data', function (chunk) {
                    body += chunk;
                });
                req.on('end', function () {
                    // TODO: Errorcheck here, but this http server should only be accessable to us, so not a security thing.
                    const msg = JSON.parse(body);

                    const blockhash = Buffer.from(msg.hash, "hex");          // We keep and send in BE format becuase easier to reverse on the client.
                    const nbits = msg.bits;
                    const height = msg.height;

                    console.log("blocknotify POST blockhash=" + blockhash.toString("hex") + " nbits=" + nbits.toString(16) + " height=" + height);


                    blockNotify(blockhash, nbits, height, lastBlockBuffer);       // Send update to clients

                    res.writeHead(200);
                    res.end();
                });
            }
        }

    });


    httpServer.listen(port);

    return httpServer;

}

// Send full initialization info to new WS connection to get them started

function starupNewWsConnection( ws , lastBlockBuffer ) {

    // Compute how long it has been since the last block came in. This helps the client show
    // the player aprox how long into the current round they are.

    const msg = updateLastBlockBufferDelay( lastBlockBuffer );

    console.log("sending [" + msg.length +"]:"+msg.toString("hex"));
    ws.send( msg );

}

// Whenever bitcoin-core gets a new block, then calls the `blocknotify` batch file, which then makes
// a `curl` call to us with the new blockhash and difficulty.

// TODO: To submit a block via CLI https://medium.com/stackfame/how-to-run-shell-script-file-or-command-using-nodejs-b9f2455cb6b7

function blockNotify(  blockhash , nbits , height , lastBlockBuffer ) {

    const nowSecs = Date.now()/1000;            // Convert milliseconds to seconds. Assumes local machine has good UTC time.

    // Note that we use height+1 since the height passed here is the height of the just-mined block,
    // but we want to send to the client the height of the next block they should mine.

    let msg;

    if ( height % 2016 == 1 ) {
        // Difficulty adjustment block. Note we check ==1 and not ==0 becuase we will not see the adjustment in the nbits
        // until the first block actually mined after the adjustment.
        // TODO:  Find a way to get the new difficulty sooner. https://bitcoin.stackexchange.com/q/106055/113175

        msg=updateLastBlockBufferAdjust( lastBlockBuffer , nowSecs, height , blockhash ,  nbits  );

    } else {
        // Normal new block, no difficulty adjust

        msg=updateLastBlockBuffer( lastBlockBuffer , nowSecs, height , blockhash  );
    }

    let count=0;

    // https://stackoverflow.com/a/62805722/3152071
    const starttime = process.uptime();
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
            count++;
        }
    });
    const endtime = process.uptime();

    console.log( "Updated "+count+" clients in "+(endtime-starttime+" seconds."));

}