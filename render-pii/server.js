const { startServers } = require('./src/server/http-server');

if (require.main === module) {
  try {
    const result = startServers();
    if (result && typeof result.then === 'function') {
      result.catch((error) => {
        console.error(error);
        process.exit(1);
      });
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

module.exports = { startServers };
