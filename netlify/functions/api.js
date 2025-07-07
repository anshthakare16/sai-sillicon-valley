const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.NETLIFY_DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: cors,
            body: ''
        };
    }

    const { httpMethod, path, body } = event;
    const segments = path.replace('/api/', '').split('/');

    try {
        let result;

        // Route handling
        if (httpMethod === 'GET' && segments[0] === 'flats') {
            if (segments[1]) {
                // Get specific flat
                const flatCode = segments[1];
                const query = await pool.query('SELECT * FROM flats WHERE flat_code = $1', [flatCode]);
                result = { success: true, data: query.rows[0] || null };
            } else {
                // Get all flats
                const query = await pool.query('SELECT * FROM flats ORDER BY wing, flat_number');
                result = { success: true, data: query.rows };
            }
        }
        else if (httpMethod === 'POST' && segments[0] === 'residents' && segments[1] === 'auth') {
            const { phone, email, flatCode } = JSON.parse(body);
            
            // Get flat
            const flatQuery = await pool.query('SELECT * FROM flats WHERE flat_code = $1', [flatCode]);
            if (flatQuery.rows.length === 0) {
                throw new Error('Invalid flat code');
            }
            const flat = flatQuery.rows[0];

            // Check existing resident
            const existingQuery = await pool.query('SELECT * FROM residents WHERE phone = $1', [phone]);
            
            let resident;
            if (existingQuery.rows.length > 0) {
                // Update existing
                const updateQuery = await pool.query(
                    'UPDATE residents SET email = $1, flat_id = $2, last_login = NOW() WHERE phone = $3 RETURNING *',
                    [email, flat.id, phone]
                );
                resident = updateQuery.rows[0];
            } else {
                // Create new
                const insertQuery = await pool.query(
                    'INSERT INTO residents (phone, email, flat_id, last_login, role) VALUES ($1, $2, $3, NOW(), $4) RETURNING *',
                    [phone, email, flat.id, 'resident']
                );
                resident = insertQuery.rows[0];
            }

            resident.flat_code = flatCode;
            result = { success: true, data: resident };
        }
        else if (httpMethod === 'POST' && segments[0] === 'visitor-requests') {
            const { visitor_name, vehicle_type, vehicle_number, purpose, flatCode, photo_url, guard_id } = JSON.parse(body);
            
            // Get flat
            const flatQuery = await pool.query('SELECT * FROM flats WHERE flat_code = $1', [flatCode]);
            if (flatQuery.rows.length === 0) {
                throw new Error('Invalid flat code');
            }
            const flat = flatQuery.rows[0];

            const insertQuery = await pool.query(
                'INSERT INTO visitor_requests (visitor_name, vehicle_type, vehicle_number, purpose, flat_id, photo_url, guard_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [visitor_name, vehicle_type, vehicle_number, purpose, flat.id, photo_url, guard_id, 'pending']
            );
            
            result = { success: true, data: insertQuery.rows[0] };
        }
        // Add more routes as needed...
        else {
            result = { success: false, error: 'Route not found' };
        }

        return {
            statusCode: 200,
            headers: { ...cors, 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers: { ...cors, 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
