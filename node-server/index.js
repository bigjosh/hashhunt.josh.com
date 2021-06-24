// Hash Hunt Websocket Server, (c) 2021 Josh Levine, http://josh.com

const websocketPort = 80;  // Port to listen for websocket connections from clients
const httpPort = 81;       // Used to let bitcoind `blocknotify` tell us about new blocks

// Passed to exec to submit a found block. bitcoin-cli must be in PATH.
// Note that I would have prefered to make this a script, but I could not figure out how to
// capture the output from a command inside a batch file and then re-emit it to the calling program.
const blockSubmitCommandTemplate = "bitcoin-core-scripts" + require("path").sep + "submitblock.bat ${block}";

let lastBlockBuffer = Buffer.alloc(256);    // Keep a prefilled buffer around so we can quickly update and send it. Make it way too big here and know about lengths in the code below.
let lastBlockTimeSecs =0;                   // Time current round started. Updated in update buffer functions.
setDefaultLastBlockBuffer(lastBlockBuffer); // Put some dummy data in the buffer until we get an update.

// We need to lift this to global scope so we can get to the OPEN static constant
const WebSocket = require('ws');

console.log("Starting websocket server on port "+websocketPort+"...");
const wss = startWebsocketServer( websocketPort );
console.log("Starting http server on port "+httpPort+"...");
const httpServer = startHttpServer(httpPort);

// Remote address+port of ws connection as string
function wsRemoteStr( ws ) {
    return ws._socket.remoteAddress +":"+  ws._socket.remotePort;
}

function wslog( ws , str , extra ) {
    // Date format https://stackoverflow.com/a/13219636/3152071
    // Remote socket ip:port  https://stackoverflow.com/questions/14822708/how-to-get-client-ip-address-with-websocket-websockets-ws-library-in-node-js
    console.log( new Date().toISOString() , wsRemoteStr(ws) , str ,  ( extra ? "["+extra+"]" : "" ) );
}

// Boilerplate from https://www.npmjs.com/package/ws#simple-server

function startWebsocketServer( websocketPort ) {

    const wss = new WebSocket.Server({ port:websocketPort });

    // New websocket connection - send startup info: time of last block, prev hash, target
    wss.on('connection', function connection(ws,req) {

        ws.intervalTimer = setInterval( ()=> ws.send("P") , 15000 );     // Send a ping message every 15 seconds so client knows we are here.

        // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/onerror#example
        ws.on( "error" , function (error) {
            wslog(ws, "ERROR", error.toString() );
        });

        ws.on( "close" , function (code,reason) {
            wslog(ws,"CLOSE" , reason );
            clearInterval( ws.intervalTimer );      // Cancel the ping sender
        } );

        wslog( ws , "OPEN " );

        starupNewWsConnection( ws , lastBlockBuffer );

        // Note that we should send info about a new block about every 10 minutes.
        // If that send times out, the socket closes so we don't bother doing pings.

        ws.on('message', function incoming(message) {
            // For now the only thing we receive from the client is a mined block, which we turn around and submit.

            wslog( ws , "BLOCK" , message.toString("hex")  );

            if (isBlockValid(message)) {
                console.log("block looks valid, submitting to node...");
                submitblock(message , function(s) {
                    ws.send( s.padEnd( 20 , " ").substr( 0 , 20) );     // Len=20 indicates the final result string from submitblock.
                });
                ws.send('A');       // Send accept receipt back to the client.
            } else {
                console.log("rejecting block...");
                ws.send('J');       // Send reject receipt back to the client. (Anything but A is reject for now)
            }
        });


    });

    return wss;

}

// Checks that a block is ours based on if the coinbase has hashhunt data in it
// For now I want to leave this wide open so anyone can independently do end-to-end testing
// to make sure everything is on the up-and-up.
// Not sure why anyone would want to DOS a system like this, but if they do I can add
// checks here to make sure the height is right and the block hash checks out so DOSing
// would be as expensive as just mining!

function isBlockValid(b) {

    // Make sure it is one of ours.
    // The position of the string in the block was found empirically and may need to be updated if anything
    // in the client block generation code changes. Note that to make this work, I had to use a fixed-length 4-byte
    // push for the height in the coinbase transaction or else this could have moved around depending on which
    // chain you are on.

    if (b.slice(129,129+22).toString() != "Play Hashhunt.josh.com") {
        console.log("mismatch block tag:"+b.slice(125,24).toString());
        return false;
    }

    return true;
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
        let cbString="";
        if (err) {
            //some err occurred
            cbString ="ERROR:"+err;
            cb("ERROR NUM:"+err);
        } else {
            console.log( `submitblock result: stdout=${stdout}, stderr=${stderr}`);
            cb(stdout);     // The stdout from submitblock has any reject reasons as text
        }
    });

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
                        let nbits = parseInt( msg.bits , 16 );              // Convert from hex string to number
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

                        blockNotify(blockhash, nbits, height, lastBlockBuffer);       // Send update to clients

                    } catch(e) {

                        console.log("Error from PUT:"+e.toString()); // error in the above string (in this case, yes)!
                        console.log("body:>"+body+"<");
                    }

                    res.writeHead(200);
                    res.end();
                });
            }
        } else if (pathname.startsWith("/status")) {

            // Return a little status page so we can see who is connected.

            res.writeHead(200, {'Content-Type': 'text/html'});

            let s="<html><body><table border='1'>";

            let count=1;

            wss.clients.forEach(function (ws) {
                s+= "<tr><td style='text-align:right'>"+ (count++) + "</td><td>" + wsRemoteStr(ws) + "</td></tr>";
            });

            s+="</table></body></html>";

            res.write(s);

            res.end('###');

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