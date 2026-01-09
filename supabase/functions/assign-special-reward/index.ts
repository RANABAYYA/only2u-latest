// Setup:
// 1. Create function: supabase functions new assign-special-reward
// 2. Deploy: supabase functions deploy assign-special-reward
// 3. Set vars: supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { referralCode, userId } = await req.json()

        if (!referralCode || !userId) {
            throw new Error('Missing referralCode or userId')
        }

        console.log(`Processing reward for User: ${userId}, Code: ${referralCode}`)

        // 1. Check if the referral code is a "Special Referral Code"
        const { data: specialCode, error: specialError } = await supabaseAdmin
            .from('special_referral_codes')
            .select('id')
            .eq('code', referralCode.toUpperCase())
            .eq('is_active', true)
            .maybeSingle()

        if (specialError) {
            console.error('Error checking special referral code:', specialError)
            throw new Error('Database error checking referral code')
        }

        console.log('Special code check result:', specialCode ? 'Valid Special Code' : 'Not Special');

        if (!specialCode) {
            console.log('Referral code is not special. No reward assigned.')
            return new Response(
                JSON.stringify({ success: false, message: 'Not a special referral code' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Check if user already has a Shubhamastu code assigned (idempotency)
        const { data: existingAssignment } = await supabaseAdmin
            .from('shubhamastu_codes')
            .select('code')
            .eq('assigned_to_user_id', userId)
            .maybeSingle()

        if (existingAssignment) {
            console.log('User already has a code:', existingAssignment.code)
            return new Response(
                JSON.stringify({ success: true, code: existingAssignment.code, message: 'Code already assigned' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Assign an available Shubhamastu code from the pool
        console.log('Attempting to find available code...');
        const { data: candidateCode, error: candidateError } = await supabaseAdmin
            .from('shubhamastu_codes')
            .select('id, code')
            .eq('is_assigned', false)
            .limit(1)
            .maybeSingle()

        if (candidateError) {
            console.error('Error finding candidate code:', candidateError);
        }

        if (!candidateCode) {
            console.error('No available Shubhamastu codes found in pool.');
            return new Response(
                JSON.stringify({ success: false, message: 'No reward codes available' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`Found candidate code: ${candidateCode.code} (ID: ${candidateCode.id}). Assigning...`);

        // Attempt to lock/update this code
        const { data: updatedCode, error: updateError } = await supabaseAdmin
            .from('shubhamastu_codes')
            .update({
                is_assigned: true,
                assigned_to_user_id: userId,
                assigned_at: new Date().toISOString()
            })
            .eq('id', candidateCode.id)
            .eq('is_assigned', false) // Optimistic locking check
            .select()
            .single()

        if (updateError || !updatedCode) {
            // If update failed (likely race condition), we should ideally retry, but for now we error out or return generic message
            console.error('Failed to assign code (update error or race condition):', updateError)
            return new Response(
                JSON.stringify({ success: false, message: 'Failed to assign code, please try again' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`Successfully assigned code ${updatedCode.code} to user ${userId}`)

        return new Response(
            JSON.stringify({ success: true, code: updatedCode.code }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error in assign-special-reward:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
