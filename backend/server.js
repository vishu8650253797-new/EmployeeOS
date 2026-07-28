require('dotenv').config();
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const seedAdmin = require('./src/utils/seedAdmin');
const { initSocketServer } = require('./src/utils/socketServer');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    await connectDB(process.env.MONGODB_URI);
    if (process.env.SEED_ADMIN === 'true') {
      await seedAdmin();
    }
    const server = app.listen(PORT, () => {
      console.log(`EmployeeOS API running on http://localhost:${PORT}`);
    });

    initSocketServer(server);

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Kill the existing process and try again.`);
      } else {
        console.error('Server error:', error.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
