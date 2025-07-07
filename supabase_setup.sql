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

-- Create residents table for persistent login
CREATE TABLE IF NOT EXISTS residents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    flat_number VARCHAR(10) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create visitor_requests table to track all visitor entries
CREATE TABLE IF NOT EXISTS visitor_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guard_id VARCHAR(50) DEFAULT 'guard-1',
    flat_number VARCHAR(10) NOT NULL,
    visitor_name VARCHAR(255) NOT NULL,
    visitor_phone VARCHAR(15),
    photo_url TEXT,
    vehicle_number VARCHAR(20),
    vehicle_type VARCHAR(20),
    purpose TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
    entry_time TIMESTAMP WITH TIME ZONE,
    exit_time TIMESTAMP WITH TIME ZONE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    denied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE flats ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for residents table
CREATE POLICY "Allow residents to read their own data" ON residents FOR SELECT USING (true);
CREATE POLICY "Allow residents to insert their own data" ON residents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow residents to update their own data" ON residents FOR UPDATE USING (true);

-- Create policies for visitor_requests table
CREATE POLICY "Allow all to read visitor requests" ON visitor_requests FOR SELECT USING (true);
CREATE POLICY "Allow all to insert visitor requests" ON visitor_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all to update visitor requests" ON visitor_requests FOR UPDATE USING (true);

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

-- Enable realtime for visitor_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE visitor_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE residents;

-- Create function to automatically delete old visitor records (20 days)
CREATE OR REPLACE FUNCTION delete_old_visitors()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM visitor_requests
    WHERE created_at < NOW() - INTERVAL '20 days';
END;
$$;
