## blocknotify

These scripts are called by the `blocknotify` event in `bitcoin-core` whenever a new block is mined.

They first get the info of the new block as JSON, then submit it to the local websocket server over a special http RPC port that is oped just for this purpose.  

One version for BASH and one for Windows Batch. Both horribly ugly.

They need to be updated to match the actual paths of the bitcoin-core installation.

## submitblock

These scripts  are called by the websocket server whenever a client submits a potentially winning block. They 
submit the block to the `bitcoin-core` node over RPC and it should then submit them to the network. 

