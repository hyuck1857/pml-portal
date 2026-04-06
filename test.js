const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient('https://vuuvkmomddjtutvywppk.supabase.co', 'sb_publishable_EegoteZDHMqAQHG13a1aTg_K6O-3I9C');

async function test() {
    try {
        const { data, error } = await supabase.from('members').select('*');
        fs.writeFileSync('out.txt', JSON.stringify({ data, error }, null, 2));
    } catch (e) {
        fs.writeFileSync('out.txt', e.message);
    }
}
test();
