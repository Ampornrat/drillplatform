import { config } from 'dotenv'
import path from 'path'

// Load .env.local for all vitest runs
config({ path: path.resolve(process.cwd(), '.env.local') })
