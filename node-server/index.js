// Hash Hunt Websocket Server, (c) 2021 Josh Levine, http://josh.com

const websocketPort = 80;  // Port to listen for websocket connections from clients
const httpPort = 81;       // Used to let bitcoind `blocknotify` tell us about new blocks

// Passed to exec to submit a found block using the script in `bitcoin-core-scripts`
// https://nodejs.org/api/path.html#path_path_join_paths
const blockSubmitCommandTemplate = require("path").join( "bitcoin-core-scripts" , "submitblock.bat") + " ${block}";

let lastBlockBuffer = Buffer.alloc(256);    // Keep a prefilled buffer around so we can quickly update and send it. Make it way too big here and know about lengths in the code below.
let lastBlockTimeSecs =0;                   // Time current round started. Updated in update buffer functions.
setDefaultLastBlockBuffer(lastBlockBuffer); // Put some dummy data in the buffer until we get an update.

// We need to lift this to global scope so we can get to the OPEN static constant
const WebSocket = require('ws');

console.log("Starting websocket server on port "+websocketPort+"...");
const wss = startWebsocketServer( websocketPort );
console.log("Starting http server on port "+httpPort+"...");
const httpServer = startHttpServer(httpPort);

// Remember the target for the current nbits so we can check submitted blocks to make sure they
// have enough work in them. Updated by updateLastBlockBufferAdjust()
let currentTargetHexString="";

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
            console.log('RECIEVED BLOCK!' );

            if (isBlockValid(message)) {
                console.log("block looks valid, sumbitting to node...");
                submitblock(message , function (s) {
                    console.log("In cb:"+s);
                });
                ws.send('A');       // Send accept reciept back to the client.
            } else {
                console.log("rejecting block...");
                ws.send('J');       // Send reject reciept back to the client. (Anything but A is reject for now)
            }
        });
    });

    return wss;

}

// Returns a 256 bit/32 byte buffer of the target in bitcoin LE format
// Based on https://developer.bitcoin.org/reference/block_chain.html#target-nbits
// Test here https://dlt-repo.net/bitcoin-target-calculator/
// I think the string functions end up being more elegant than the typical math-based solutions, don't you?

function nbits2target(nbits) {
    const significand = nbits & 0x00ffffff;
    const exponent = nbits >>> (8*3);

    // (all `*2` are becuase calcuations are in bytes, but in string 1 byte = 2 letter places)

    const fixed6SigString =  (significand.toString(16)).padStart( 3*2 , "0");
    //  a 3 digit (6 byte) hex string with a leading fixed point

    const paddedSigString = ("00").repeat(32) + fixed6SigString + ("00").repeat(32) ;
    // padded string has a fixed (hexa)decimal point after byte 32

    const expString = paddedSigString.slice( exponent*2, (32+exponent)*2);
    // Now we move the point to the right exp bytes

    return Buffer.fromHexString( expString );     // Put back in bitcoin LE format
}

// Checks that a block is valid so we don't waste effort submitting bad blocks to bitcoin-core since
// it is expensive. Check...
// height is right
// coinbase has hashhunt data in it
// hash has some work in it (at least more work than it takes us to submit it)

// For SHA256
import { createHmac } from 'crypto';

function isBlockValid(b) {

    // // https://nodejs.org/api/crypto.html#crypto_crypto
    // const hash = createHmac('sha256', secret)
    //     .update(b)
    //     .digest('hex');
    //
    // //Make sure they at least put a little effort into it
    // if (hash>=currentTargetHexString) {
    //     return false;
    // }

    // Make sure it is one of ours
    if (b.slice(125,24).toString() != "/Play Hashhunt.josh.com/") {
        return false;
    }

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
    console.log("nbits="+nbits);
    currentTargetHexString = nbits2target(nbits);   // Remember this so we can check submitted blocks
    b.writeUInt32LE( nbits , 4+4+32 );
    console.log("b:"+b.slice( 0 , 4+4+32 + 4).toString("hex"));
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

const child_process = require('child_process');

// Submit a block to the local bitcoind using the cli
// cb(string) gets called with a human readable string indicating how it turned out.

function submitblock( b , cb ) {

    // Run a batch file to submit the block to bitcoin core over RPC
    // This is slightly scary becuase we are passing something that came in off the network into an exec(),
    // but I think (hope?) OK because we only send it as a hex string of the data so how back could it be?
    const commandline = blockSubmitCommandTemplate.replace( "${block}" , b.toString("hex") );
    console.log("Submitting block command:"+commandline);
    child_process.exec( commandline ,  function(err, stdout, stderr) {
        if (err) {
            //some err occurred
            const cbString ="ERROR:"+err;
        } else {
            // the *entire* stdout and stderr (buffered)
            const cbString =`stdout: ${stdout}, stderr: ${stderr}`);
        }
        console.log("submitBlock callback:"+cbString);
        cb(cbString);
    });

    // TODO: To submit a block via CLI https://medium.com/stackfame/how-to-run-shell-script-file-or-command-using-nodejs-b9f2455cb6b7
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
                const nbits = parseInt( queryObject.nbits , 16 );
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

                    // Handle JSON parsing errors https://stackoverflow.com/a/4467327/3152071
                    try {
                        const msg = JSON.parse(body);

                        const blockhash = Buffer.from(msg.hash, "hex");          // We keep and send in BE format becuase easier to reverse on the client.
                        let nbits = parseInt( msg.bits , 16 );                 // Convert from hex string to number
                        const height = msg.height;                               // Sent as decimal string so will become number in javascript magic

                        // The nbits on regtest is always the easiest possible, which does not make for good testing.
                        // So we force it to be harder. This works becuase a harder hash will always be good enough to
                        // work for an easier hash. `207fffff` is the hardcoded nbits on regtest.
                        // Note that these fake-hard blocks will not be accepted by bitcoin core since the nbits doesn't match expected value.

                        // if (nbits== parseInt("207fffff",16) ) {
                        //     console.log("Adjusting difficulty for regtest network to 1 in 256 (two hashes)");
                        //     nbits= parseInt("20010000",16);
                        // }

                        console.log("blocknotify POST blockhash=" + blockhash.toString("hex") + " nbits=" + nbits.toString(16) + " height=" + height);

                        // TODO:
                        // setDOSFilterDifficulty( nbits );

                        blockNotify(blockhash, nbits, height, lastBlockBuffer);       // Send update to clients

                    } catch(e) {

                        console.log("Error from PUT:"+e.toString()); // error in the above string (in this case, yes)!
                        console.log("body:>"+body+"<");
                    }

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
// nbits and height are numbers, blockhash and lastBlockBuffer are buffers

function blockNotify(  blockhash , nbits , height , lastBlockBuffer ) {

    const nowSecs = Date.now()/1000;            // Convert milliseconds to seconds. Assumes local machine has good UTC time.

    // Note that we use height+1 since the height passed here is the height of the just-mined block,
    // but we want to send to the client the height of the next block they should mine.

    let msg;

    // TODO: For now we will always send nbits even when it does not change. We can optimize when things are stable.
    if ( height % 2016 == 1 || true ) {
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