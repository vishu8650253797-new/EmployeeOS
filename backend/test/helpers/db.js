const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet;

async function connect() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = replSet.getUri();
  await mongoose.connect(uri, { dbName: 'employeeos-test' });
  // Index creation (incl. unique/partial indexes) happens in the background
  // by default — without waiting for it, a test asserting duplicate-key
  // rejection can race a not-yet-built index and see a false negative.
  await Promise.all(Object.values(mongoose.connection.models).map((m) => m.init()));
}

async function closeDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (replSet) await replSet.stop();
}

async function clearDatabase() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

module.exports = { connect, closeDatabase, clearDatabase };
