import { Client } from 'cassandra-driver';
import dotenv from 'dotenv';

dotenv.config();

export const cassandraClient = new Client({
  contactPoints: [process.env.CASSANDRA_HOST || 'localhost:9042'],
  localDataCenter: process.env.CASSANDRA_DATACENTER || 'datacenter1',
  keyspace: 'chat_keyspace',
  credentials: {
    username: process.env.CASSANDRA_USER || 'cassandra',
    password: process.env.CASSANDRA_PASSWORD || 'cassandra',
  },
});

cassandraClient.connect()
  .then(() => {
    console.log('✅ Chat Service Cassandra connected');
  })
  .catch((err) => {
    console.error('❌ Cassandra connection error:', err);
  });

export default cassandraClient;

