# docs

This directory contains the static web site that is served at http://hashunt.josh.com.

It is called `docs` because it is hosted on GitHub pages and that is apparently the only folder name you can use.

## index.html

The actual game made out of html, css, and js all in one file because that is the way I like it. 

You can call this with two optional params...

`ws` gives a full URL to an alternate websocket server. 

`nBits` gives a forced value for nBits. This value will not be overwritten by updates from the websocket server. A value of `0x20010000` needs only two hashes and is winnable in a few minutes, especially if you hold down the mouse and slide or use km.  

These are intended for testing wins, but note that any invalid win will be rejected by `bitcoin-core` so don't bother trying to cheat. 

## info.html

The `more info` link on the game page.   
     

