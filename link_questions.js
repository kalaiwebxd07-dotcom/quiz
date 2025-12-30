const { createClient } = require('@supabase/supabase-js');
const { decrypt } = require('./encryptor');
require('dotenv').config();

async function migrate() {
    console.log('🚀 Starting migration: Linking questions to tests...');

    const SUPABASE_URL = decrypt(process.env.SUPABASE_URL);
    const SUPABASE_KEY = decrypt(process.env.SUPABASE_KEY);

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ Missing credentials');
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Get or Create the default Test
    let { data: test, error } = await supabase
        .from('tests')
        .select('id')
        .eq('name', 'Java MCQ Quiz')
        .single();

    if (error || !test) {
        console.log('ℹ️ Default test not found, creating it...');
        const { data: newTest, error: createError } = await supabase
            .from('tests')
            .insert([{
                name: 'Java MCQ Quiz',
                description: 'Test your Java programming knowledge',
                duration: 10,
                is_active: true
            }])
            .select()
            .single();

        if (createError) {
            console.error('❌ Failed to create test:', createError.message);
            return;
        }
        test = newTest;
    }

    console.log(`✅ Target Test ID: ${test.id}`);

    // 2. Count orphan questions
    const { count, error: countError } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .is('test_id', null);

    if (countError) {
        console.error('❌ Error checking questions:', countError.message);
        return;
    }

    console.log(`ℹ️ Found ${count} orphan questions.`);

    if (count === 0) {
        console.log('✨ No questions need linking.');
        return;
    }

    // 3. Update orphan questions
    const { error: updateError } = await supabase
        .from('questions')
        .update({ test_id: test.id })
        .is('test_id', null);

    if (updateError) {
        console.error('❌ Failed to update questions:', updateError.message);
    } else {
        console.log(`🎉 Successfully linked ${count} questions to test "${test.id}".`);
    }
}

migrate();
