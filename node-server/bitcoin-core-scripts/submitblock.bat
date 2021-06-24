@REM This script is called by the websocket server when a user submits a solved block.
@REM It submits the block to the bitcoin-core. The node server captures the stdout to see the results. 
@bitcoin-cli submitblock %1
