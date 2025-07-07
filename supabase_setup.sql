-- Sai Silicon Valley Visitor Management System Database Schema (Fixed)

-- Create flats table to store all apartment information
CREATE TABLE IF NOT EXISTS flats (
    id SERIAL PRIMARY KEY,
    wing CHAR(1) NOT NULL CHECK (wing IN ('A', 'B', 'C', 'D', 'E')),
    flat_number INTEGER NOT NULL CHECK (flat_number BETWEEN 101 AND 505),
    flat_code VARCHAR(10) GENERATED ALWAYS AS (wing || flat_number) STORED,
    primary_phone VARCHAR(15),
    primary_email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wing, flat_number)
);

-- Create residents table for persistent login (simplified, removing redundant users table)
CREATE TABLE IF NOT EXISTS residents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    flat_id INTEGER NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'resident' CHECK (role IN ('resident', 'guard', 'admin')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create visitor_requests table to track all visitor entries
CREATE TABLE IF NOT EXISTS visitor_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guard_id VARCHAR(50) DEFAULT 'guard-1',
    flat_id INTEGER NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
    visitor_name VARCHAR(255) NOT NULL,
    visitor_phone VARCHAR(15),
    photo_url TEXT,
    vehicle_number VARCHAR(20),
    vehicle_type VARCHAR(20),
    purpose TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
    entry_time TIMESTAMP WITH TIME ZONE,
    exit_time TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES residents(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    denied_at TIMESTAMP WITH TIME ZONE,
    denied_by UUID REFERENCES residents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit log table for security tracking
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_flats_wing ON flats(wing);
CREATE INDEX IF NOT EXISTS idx_flats_flat_code ON flats(flat_code);
CREATE INDEX IF NOT EXISTS idx_residents_phone ON residents(phone);
CREATE INDEX IF NOT EXISTS idx_residents_email ON residents(email);
CREATE INDEX IF NOT EXISTS idx_residents_flat_id ON residents(flat_id);
CREATE INDEX IF NOT EXISTS idx_visitor_requests_flat_id ON visitor_requests(flat_id);
CREATE INDEX IF NOT EXISTS idx_visitor_requests_status ON visitor_requests(status);
CREATE INDEX IF NOT EXISTS idx_visitor_requests_created_at ON visitor_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_visitor_requests_guard_id ON visitor_requests(guard_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_flats_updated_at BEFORE UPDATE ON flats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_residents_updated_at BEFORE UPDATE ON residents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitor_requests_updated_at BEFORE UPDATE ON visitor_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE flats ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for flats table
CREATE POLICY "Allow public read access to flats" ON flats FOR SELECT USING (true);
CREATE POLICY "Allow admin insert on flats" ON flats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin update on flats" ON flats FOR UPDATE USING (true);

-- Create RLS policies for residents table
CREATE POLICY "Allow residents to read their own data" ON residents 
    FOR SELECT USING (auth.uid()::text = id::text OR true);
CREATE POLICY "Allow public insert on residents" ON residents 
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow residents to update their own data" ON residents 
    FOR UPDATE USING (auth.uid()::text = id::text OR true);

-- Create RLS policies for visitor_requests table
CREATE POLICY "Allow public read visitor requests" ON visitor_requests 
    FOR SELECT USING (true);
CREATE POLICY "Allow public insert visitor requests" ON visitor_requests 
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update visitor requests" ON visitor_requests 
    FOR UPDATE USING (true);

-- Create RLS policies for audit_logs table
CREATE POLICY "Allow admin read audit logs" ON audit_logs 
    FOR SELECT USING (true);
CREATE POLICY "Allow system insert audit logs" ON audit_logs 
    FOR INSERT WITH CHECK (true);

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

-- Create function to automatically delete old visitor records (20 days)
CREATE OR REPLACE FUNCTION delete_old_visitors()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM visitor_requests
    WHERE created_at < NOW() - INTERVAL '20 days';
    
    -- Log the cleanup action
    INSERT INTO audit_logs (table_name, operation, new_data)
    VALUES ('visitor_requests', 'CLEANUP', 
            jsonb_build_object('deleted_count', 
                (SELECT COUNT(*) FROM visitor_requests 
                 WHERE created_at < NOW() - INTERVAL '20 days')));
END;
$$;

-- Create a scheduled job to run cleanup (if using pg_cron extension)
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule('delete-old-visitors', '0 2 * * *', 'SELECT delete_old_visitors();');

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE flats;
ALTER PUBLICATION supabase_realtime ADD TABLE residents;
ALTER PUBLICATION supabase_realtime ADD TABLE visitor_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;

-- Create view for easy querying of visitor requests with flat details
CREATE OR REPLACE VIEW visitor_requests_with_flat_details AS
SELECT 
    vr.*,
    f.wing,
    f.flat_number,
    f.flat_code,
    r.full_name as approved_by_name,
    r.phone as approved_by_phone
FROM visitor_requests vr
JOIN flats f ON vr.flat_id = f.id
LEFT JOIN residents r ON vr.approved_by = r.id;

-- Create function to get flat_id from flat_code (for backward compatibility)
CREATE OR REPLACE FUNCTION get_flat_id_by_code(flat_code_param VARCHAR(10))
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    flat_id_result INTEGER;
BEGIN
    SELECT id INTO flat_id_result
    FROM flats
    WHERE flat_code = flat_code_param;
    
    RETURN flat_id_result;
END;
$$;

-- Create function to get flat_code from flat_id
CREATE OR REPLACE FUNCTION get_flat_code_by_id(flat_id_param INTEGER)
RETURNS VARCHAR(10)
LANGUAGE plpgsql
AS $$
DECLARE
    flat_code_result VARCHAR(10);
BEGIN
    SELECT flat_code INTO flat_code_result
    FROM flats
    WHERE id = flat_id_param;
    
    RETURN flat_code_result;
END;
$$;
