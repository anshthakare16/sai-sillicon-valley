
-- Sai Silicon Valley Visitor Management System Database Schema

-- Create flats table to store all apartment information
CREATE TABLE IF NOT EXISTS flats (
    id SERIAL PRIMARY KEY,
    wing CHAR(1) NOT NULL CHECK (wing IN ('A', 'B', 'C', 'D', 'E')),
    flat_number INTEGER NOT NULL CHECK (flat_number BETWEEN 101 AND 505),
    primary_phone VARCHAR(15),
    primary_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wing, flat_number)
);

-- Create users table for residents, guards, and admin
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('resident', 'guard', 'admin')),
    flat_id INTEGER REFERENCES flats(id),
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create visitors table to track all visitor entries
CREATE TABLE IF NOT EXISTS visitors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guard_id UUID REFERENCES users(id),
    flat_id INTEGER REFERENCES flats(id) NOT NULL,
    visitor_name VARCHAR(255) NOT NULL,
    visitor_phone VARCHAR(15),
    photo_url TEXT,
    vehicle_number VARCHAR(20),
    vehicle_type VARCHAR(20),
    visit_purpose TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
    entry_time TIMESTAMP WITH TIME ZONE,
    exit_time TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE flats ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

-- Create policies for flats table
CREATE POLICY "Anyone can read flats" ON flats FOR SELECT USING (true);
CREATE POLICY "Only admin can modify flats" ON flats FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Create policies for users table
CREATE POLICY "Users can read their own data" ON users FOR SELECT USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'guard'))
);

CREATE POLICY "Only admin can manage users" ON users FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Create policies for visitors table
CREATE POLICY "Guards can manage visitors" ON visitors FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('guard', 'admin'))
);

CREATE POLICY "Residents can view and approve their visitors" ON visitors FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'resident' 
        AND users.flat_id = visitors.flat_id
    )
);

CREATE POLICY "Residents can update visitor status" ON visitors FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'resident' 
        AND users.flat_id = visitors.flat_id
    )
) WITH CHECK (
    status IN ('approved', 'denied')
);

-- Insert flat data for wings A through E (floors 1-5, units 01-05)
INSERT INTO flats (wing, flat_number) 
SELECT wing, (floor * 100 + unit) as flat_number
FROM (
    SELECT unnest(ARRAY['A', 'B', 'C', 'D', 'E']) as wing
) wings
CROSS JOIN (
    SELECT unnest(ARRAY[1, 2, 3, 4, 5]) as floor
) floors
CROSS JOIN (
    SELECT unnest(ARRAY[1, 2, 3, 4, 5]) as unit
) units
ON CONFLICT (wing, flat_number) DO NOTHING;

-- Create default admin user (password should be set via Supabase auth)
INSERT INTO users (phone, email, role, full_name) 
VALUES ('+919999999999', 'admin@saisiliconvalley.com', 'admin', 'System Administrator')
ON CONFLICT (phone) DO NOTHING;

-- Create default guard user
INSERT INTO users (phone, email, role, full_name) 
VALUES ('+919999999998', 'guard@saisiliconvalley.com', 'guard', 'Security Guard')
ON CONFLICT (phone) DO NOTHING;

-- Enable realtime for visitors table
ALTER PUBLICATION supabase_realtime ADD TABLE visitors;

-- Create function to automatically set TTL for old visitor records (20 days)
CREATE OR REPLACE FUNCTION delete_old_visitors() 
RETURNS void 
LANGUAGE plpgsql 
AS $$
BEGIN
    DELETE FROM visitors 
    WHERE created_at < NOW() - INTERVAL '20 days';
END;
$$;

-- Create a scheduled job to run the cleanup function daily
-- Note: This requires pg_cron extension which may need to be enabled
-- SELECT cron.schedule('cleanup-old-visitors', '0 2 * * *', 'SELECT delete_old_visitors();');
