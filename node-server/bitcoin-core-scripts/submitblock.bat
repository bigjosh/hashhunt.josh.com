REM This script is called by the websocket server when a client sumbits a potentially winning new block
REM The new block is the argument in RAW BLOCK format (hex string) 

REM We need to specify the datadir used by `bitcoin-core` so that `blitcoin-cli` can find the cookie file to authenticate
REM Really bitcoin-core, you could just have the deamon and cli use the same config file by default :/
set datadir="D:\Documents\Programs\bitcoin\data\regtest"

bitcoin-cli -datadir=%datadir% submitblock %1



	