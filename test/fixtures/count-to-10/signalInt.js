console.log('signal-int script');

// Emit SIGINT event for the process
process.kill(process.pid, 'SIGINT');