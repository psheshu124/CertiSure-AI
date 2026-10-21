import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkIsolation() {
  const { data: certs } = await supabase.from('certificates').select('id, certificate_number, student_name');
  const { data: history } = await supabase.from('verification_history').select('id, certificate_id, status');

  console.log('--- SUPABASE ISOLATION AUDIT ---');
  console.log(`Total production certificates: ${certs?.length || 0}`);
  certs?.forEach(c => console.log(` - ID: ${c.id} | Cert#: ${c.certificate_number} | Candidate: ${c.student_name}`));
  console.log(`Total verification history entries: ${history?.length || 0}`);
}

checkIsolation();
