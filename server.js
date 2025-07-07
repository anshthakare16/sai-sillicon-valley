const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
    connectionString: process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: ['http://localhost:3000', 'https://your-netlify-app.netlify.app'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to Neon PostgreSQL database');
        release();
    }
});

// Routes

// Get all flats
app.get('/api/flats', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM flats ORDER BY wing, flat_number'
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching flats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get flat by code
app.get('/api/flats/:flatCode', async (req, res) => {
    try {
        const { flatCode } = req.params;
        const result = await pool.query(
            'SELECT * FROM flats WHERE flat_code = $1',
            [flatCode]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Flat not found' });
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching flat:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Register/Login resident
app.post('/api/residents/auth', async (req, res) => {
    try {
        const { phone, email, flatCode } = req.body;
        
        if (!phone || !email || !flatCode) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phone, email, and flat code are required' 
            });
        }

        // Get flat information
        const flatResult = await pool.query(
            'SELECT * FROM flats WHERE flat_code = $1',
            [flatCode]
        );

        if (flatResult.rows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid flat code' 
            });
        }

        const flat = flatResult.rows[0];

        // Check if resident already exists
        const existingResult = await pool.query(
            'SELECT * FROM residents WHERE phone = $1',
            [phone]
        );

        let resident;
        
        if (existingResult.rows.length > 0) {
            // Update existing resident
            const updateResult = await pool.query(
                `UPDATE residents 
                 SET email = $1, flat_id = $2, last_login = NOW(), updated_at = NOW()
                 WHERE phone = $3
                 RETURNING *`,
                [email, flat.id, phone]
            );
            resident = updateResult.rows[0];
        } else {
            // Create new resident
            const insertResult = await pool.query(
                `INSERT INTO residents (phone, email, flat_id, last_login, role)
                 VALUES ($1, $2, $3, NOW(), 'resident')
                 RETURNING *`,
                [phone, email, flat.id]
            );
            resident = insertResult.rows[0];
        }

        // Add flat information to response
        resident.flat_code = flatCode;
        resident.flat_number = flatCode;

        res.json({ success: true, data: resident });
    } catch (error) {
        console.error('Error with resident auth:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify resident session
app.get('/api/residents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT r.*, f.flat_code, f.wing, f.flat_number
             FROM residents r
             JOIN flats f ON r.flat_id = f.id
             WHERE r.id = $1 AND r.is_active = true`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Resident not found' });
        }
        
        const resident = result.rows[0];
        resident.flat_number = resident.flat_code; // For backward compatibility
        
        res.json({ success: true, data: resident });
    } catch (error) {
        console.error('Error fetching resident:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit visitor request
app.post('/api/visitor-requests', async (req, res) => {
    try {
        const {
            visitor_name,
            vehicle_type,
            vehicle_number,
            purpose,
            flatCode,
            photo_url,
            guard_id = 'guard-1'
        } = req.body;

        if (!visitor_name || !flatCode || !photo_url) {
            return res.status(400).json({ 
                success: false, 
                error: 'Visitor name, flat code, and photo are required' 
            });
        }

        // Get flat information
        const flatResult = await pool.query(
            'SELECT * FROM flats WHERE flat_code = $1',
            [flatCode]
        );

        if (flatResult.rows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid flat code' 
            });
        }

        const flat = flatResult.rows[0];

        // Insert visitor request
        const result = await pool.query(
            `INSERT INTO visitor_requests 
             (visitor_name, vehicle_type, vehicle_number, purpose, flat_id, photo_url, guard_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
             RETURNING *`,
            [visitor_name, vehicle_type, vehicle_number, purpose, flat.id, photo_url, guard_id]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating visitor request:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pending visitor requests (for guards)
app.get('/api/visitor-requests/pending', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT vr.*, f.wing, f.flat_number, f.flat_code
             FROM visitor_requests vr
             JOIN flats f ON vr.flat_id = f.id
             WHERE vr.status = 'pending'
             ORDER BY vr.created_at DESC`
        );
        
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching pending requests:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pending approvals for a resident
app.get('/api/visitor-requests/pending/:flatId', async (req, res) => {
    try {
        const { flatId } = req.params;
        const result = await pool.query(
            `SELECT vr.*, f.wing, f.flat_number, f.flat_code
             FROM visitor_requests vr
             JOIN flats f ON vr.flat_id = f.id
             WHERE vr.flat_id = $1 AND vr.status = 'pending'
             ORDER BY vr.created_at DESC`,
            [flatId]
        );
        
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching pending approvals:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get visitor history for a resident
app.get('/api/visitor-requests/history/:flatId', async (req, res) => {
    try {
        const { flatId } = req.params;
        const result = await pool.query(
            `SELECT vr.*, f.wing, f.flat_number, f.flat_code
             FROM visitor_requests vr
             JOIN flats f ON vr.flat_id = f.id
             WHERE vr.flat_id = $1 AND vr.status != 'pending'
             ORDER BY vr.created_at DESC
             LIMIT 20`,
            [flatId]
        );
        
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching visitor history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Approve visitor request
app.put('/api/visitor-requests/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { approved_by } = req.body;
        
        const result = await pool.query(
            `UPDATE visitor_requests 
             SET status = 'approved', approved_at = NOW(), approved_by = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [approved_by, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Deny visitor request
app.put('/api/visitor-requests/:id/deny', async (req, res) => {
    try {
        const { id } = req.params;
        const { denied_by } = req.body;
        
        const result = await pool.query(
            `UPDATE visitor_requests 
             SET status = 'denied', denied_at = NOW(), denied_by = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [denied_by, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error denying request:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Allow entry
app.put('/api/visitor-requests/:id/entry', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `UPDATE visitor_requests 
             SET entry_time = NOW(), status = 'completed', updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error allowing entry:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get admin statistics
app.get('/api/admin/stats', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const todayVisitorsResult = await pool.query(
            'SELECT COUNT(*) FROM visitor_requests WHERE DATE(created_at) = $1',
            [today]
        );
        
        const pendingApprovalsResult = await pool.query(
            'SELECT COUNT(*) FROM visitor_requests WHERE status = $1',
            ['pending']
        );
        
        const approvedTodayResult = await pool.query(
            'SELECT COUNT(*) FROM visitor_requests WHERE DATE(created_at) = $1 AND status = $2',
            [today, 'approved']
        );
        
        const deniedTodayResult = await pool.query(
            'SELECT COUNT(*) FROM visitor_requests WHERE DATE(created_at) = $1 AND status = $2',
            [today, 'denied']
        );
        
        res.json({
            success: true,
            data: {
                todayVisitors: parseInt(todayVisitorsResult.rows[0].count),
                pendingApprovals: parseInt(pendingApprovalsResult.rows[0].count),
                approvedToday: parseInt(approvedTodayResult.rows[0].count),
                deniedToday: parseInt(deniedTodayResult.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all visitor records (for admin)
app.get('/api/admin/visitor-records', async (req, res) => {
    try {
        const { wing, date } = req.query;
        let query = `
            SELECT vr.*, f.wing, f.flat_number, f.flat_code
            FROM visitor_requests vr
            JOIN flats f ON vr.flat_id = f.id
        `;
        const params = [];
        const conditions = [];
        
        if (wing) {
            conditions.push(`f.wing = $${params.length + 1}`);
            params.push(wing);
        }
        
        if (date) {
            conditions.push(`DATE(vr.created_at) = $${params.length + 1}`);
            params.push(date);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY vr.created_at DESC LIMIT 100';
        
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching visitor records:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = app;
