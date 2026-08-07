import { backfillGiftModelPreviews } from '../src/lib/gift-oss';

async function main() {
  const result = await backfillGiftModelPreviews(Number(process.argv[2] || 100));
  console.log(JSON.stringify(result));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
