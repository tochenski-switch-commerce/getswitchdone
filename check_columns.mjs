import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '.env.local')
const envFile = fs.readFileSync(envPath, 'utf8')

const env = {}
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=')
  if (key && value) {
    env[key.trim()] = value.join('=').trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
  // Use postgrest to query the openapi spec or just try to select specific columns
  const requiredColumns = [
    'email_notifications_enabled',
    'due_soon_notifications_enabled',
    'comment_notifications_enabled',
    'assignment_notifications_enabled'
  ]

  const results = {}

  for (const col of requiredColumns) {
    const { error } = await supabase
      .from('user_profiles')
      .select(col)
      .limit(1)
    
    // If the column doesn't exist, we usually get a 400 error with message containing "column does not exist"
    if (error) {
       if (error.message.includes('column') && (error.message.includes('does not exist') || error.message.includes('not found'))) {
         results[col] = false
       } else {
         results[col] = `Error: ${error.message}`
       }
    } else {
       results[col] = true
    }
  }

  Object.entries(results).forEach(([col, exists]) => {
    console.log(`${col}: ${exists}`)
  })
}

checkColumns()
