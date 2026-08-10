import { backfillGiftTransparentImages } from '../src/lib/gift-oss';

const limit = Number(process.argv[2] || 10_000);
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const result = await backfillGiftTransparentImages(limit, dryRun);
  console.log(JSON.stringify({ ...result, dryRun }));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
