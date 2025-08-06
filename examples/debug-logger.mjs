// Run with: node examples/simple-logger.mjs

import debug from "debug";
import splitlog from "../src/logger/index.js";

const logApp = splitlog( debug( "APP" ) );
const logDb  = splitlog( debug( "DB" ) );
const logError  = splitlog( debug( "ERROR" ) );

logApp( "Application started" );

logDb( "Connected to database" );
logDb( `SELECT p.id, p.title, p.created_at, u.username
FROM posts p
JOIN users u ON u.id = p.user_id
WHERE p.created_at > NOW() - INTERVAL 7 DAY
ORDER BY p.created_at DESC
LIMIT 10` );
logError( "Failed to fetch user data", { userId: 42, error: "User not found" } );

// Simulate some activity
setTimeout(() => {
    logApp( "User logged in", { userId: 42 } );
}, 1000 );

setTimeout(() => {
    logApp( "User logged out" );
}, 2500 );

setTimeout(() => {
    logDb( "Closing database connection" );
}, 3000 );

setTimeout(() => {
    logDb( `UPDATE projects
    SET status = 'archived', updated_at = NOW()
    WHERE last_activity_at < NOW() - INTERVAL 1 YEAR` );
}, 1300 );
