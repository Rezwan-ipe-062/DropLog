(function() {
    const SUPABASE_URL = 'https://afovfoaraolalebvookx.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmb3Zmb2FyYW9sYWxlYnZvb2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTExMDksImV4cCI6MjA5ODkyNzEwOX0.mFQa-RvRYm-Rol7_I5O0vVThAf5Tfd59w6F5Fa3w7Bw';

    const params = new URLSearchParams(window.location.search);
    const stopId = params.get('stop');

    if (!stopId) {
        document.getElementById('stopInfo').innerHTML = '<strong>Invalid link</strong><span>No stop ID provided.</span>';
        document.getElementById('btnGroup').style.display = 'none';
        return;
    }

    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    async function loadStop() {
        const { data, error } = await sb
            .from('route_stops')
            .select('customer_name, address, status, customer_response, delivery_exception')
            .eq('id', stopId)
            .single();

        if (error || !data) {
            document.getElementById('stopInfo').innerHTML = '<strong>Not found</strong><span>This delivery stop could not be found.</span>';
            document.getElementById('btnGroup').style.display = 'none';
            return;
        }

        document.getElementById('stopName').textContent = data.customer_name || 'Customer';
        document.getElementById('stopAddress').textContent = data.address || '';

        if (data.status !== 'delivered') {
            document.getElementById('btnGroup').style.display = 'none';
            document.getElementById('stopInfo').innerHTML += '<span style="color:#b71c1c;margin-top:8px;display:block;font-weight:600;">This delivery has not been marked as delivered yet.</span>';
            return;
        }

        if (data.customer_response && data.customer_response !== 'no_response') {
            document.getElementById('btnGroup').style.display = 'none';
            if (data.customer_response === 'confirmed_received') {
                document.getElementById('resultOk').style.display = 'block';
            } else {
                document.getElementById('resultNo').style.display = 'block';
            }
        }
    }

    loadStop();

    window.respond = async function(choice) {
        document.getElementById('btnGroup').style.display = 'none';
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('errorMsg').style.display = 'none';

        const now = new Date().toISOString();
        const update = {
            customer_response: choice === 'yes' ? 'confirmed_received' : 'not_received',
            customer_responded_at: now,
            customer_confirmed_at: now
        };
        if (choice === 'no') {
            update.delivery_exception = true;
        }

        const { error } = await sb.from('route_stops').update(update).eq('id', stopId);

        document.getElementById('loadingState').style.display = 'none';

        if (error) {
            document.getElementById('errorMsg').textContent = 'Something went wrong. Please try again.';
            document.getElementById('errorMsg').style.display = 'block';
            document.getElementById('btnGroup').style.display = 'flex';
            return;
        }

        if (choice === 'yes') {
            document.getElementById('resultOk').style.display = 'block';
        } else {
            document.getElementById('resultNo').style.display = 'block';
        }
    };
})();
