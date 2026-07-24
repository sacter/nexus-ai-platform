import { Worker } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

const queueName = process.env.QUEUE_NAME ?? 'default';

const worker = new Worker(
  queueName,
  async (job) => {
    console.log(`Processing job ${job.id}:`, job.name, job.data);
    // Add your job processing logic here
    return { success: true };
  },
  { connection },
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log(`Worker started on queue "${queueName}"`);

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await worker.close();
  process.exit(0);
});
