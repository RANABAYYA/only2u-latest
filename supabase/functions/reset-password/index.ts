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
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !serviceRoleKey) {
            return new Response(
                JSON.stringify({ error: 'Server configuration error' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        const requestBody = await req.json()
        const { phone } = requestBody

        if (!phone) {
            return new Response(
                JSON.stringify({ error: 'Phone number is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[ResetPassword] Request for phone: ${phone}`);

        let userId: string | null = null;
        const cleanPhone = phone.replace('+', '');

        // 1. Try Finding in public.users first (Fastest)
        const { data: publicUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .or(`phone.eq.${phone},phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
            .maybeSingle();

        if (publicUser) {
            console.log(`[ResetPassword] Found in public.users: ${publicUser.id}`);
            userId = publicUser.id;
        } else {
            console.log(`[ResetPassword] Not found in public.users. Searching Auth...`);
            // 2. Fallback: Search Auth Users (Slower, but guarantees finding the "Zombie")
            // We fetch a batch of users and filter. 
            // Warning: If you have 100k users, this is bad. But for this fix, we assume reasonable sizing.
            const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
                perPage: 1000
            });

            if (listError) {
                console.error('[ResetPassword] List Users Error:', listError);
            } else {
                const found = users.find(u =>
                    u.phone === phone ||
                    u.phone === `+${cleanPhone}` ||
                    u.phone === cleanPhone
                );
                if (found) {
                    console.log(`[ResetPassword] Found in Auth: ${found.id}`);
                    userId = found.id;
                }
            }
        }

        if (!userId) {
            return new Response(
                JSON.stringify({ error: 'User not found in system.' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Update Password
        const MOCK_PASSWORD = `O2U_SECURE_PASS_${phone}_Only2U`;

        // Also set email_confirm = true if needed, just to be safe?
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            {
                password: MOCK_PASSWORD,
                phone_confirm: true
            }
        )

        if (updateError) {
            console.error('[ResetPassword] Update Error:', updateError);
            throw updateError;
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Password reset successfully'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[ResetPassword] Unexpected Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
