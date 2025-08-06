#!/usr/bin/env node

import { Command } from "commander";
import dgram from "dgram";
import chalk from "chalk";
import fs from "fs";
import { addMessage, updateWelcomeBox } from "./lib/ui.js";

const CHANNEL_FILE = "/tmp/splitlog_channel",
      socket = dgram.createSocket( "udp4" ),
      program = new Command();

// CLI setup
program
  .name( "splitlog" )
  .description( "A UDP log monitor that listens on defined channels" )
  .option( "-p, --port <number>", "UDP port to listen on" )
  .parse( process.argv );

const options = program.opts();

socket.on( "message", ( msg ) => {
  try {
    const { channel, timestamp, payload, options } = JSON.parse( msg.toString() );
    //console.log( `[${ chalk.gray( timestamp ) }] ${ chalk.blue( channel ) }: ${ payload }` );
    addMessage( channel, payload, timestamp );
  } catch ( err ) {
    console.error( chalk.red( "Invalid message:" ), msg.toString() );
  }
});

const userPort = options.port ? parseInt( options.port, 10 ) : 0; // 0 means dynamic port

socket.once( "error", ( err ) => {
  if ( err.code === "EADDRINUSE" ) {
    console.error( chalk.red( `Error: Port ${ userPort } is already in use.` ) );
  } else if ( err.code === "EACCES" ) {
    console.error( chalk.red( `Error: Permission denied to bind to port ${ userPort }. Try a port >1024 or run with elevated privileges.` ) );
  } else {
    console.error( chalk.red( `Socket error: ${ err.message }` ) );
  }
  process.exit( 1 );
});

socket.bind( userPort, () => {
  const port = socket.address().port;
  fs.writeFileSync( CHANNEL_FILE, port.toString() );
  updateWelcomeBox( `Waiting for logs on port ${ port }...\n\nNo channels yet.` );
  if ( !userPort ) {
    console.log( chalk.yellow( `No --port provided. Using first available port (${ port }).`) );
    console.log( chalk.yellow( `Temporary stream started. Clients should discover this port dynamically.` ) );
    return;
  }
  console.log( chalk.green( `Listening on UDP port ${ port }...` ) );
});
