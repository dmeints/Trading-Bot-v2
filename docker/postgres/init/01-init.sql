-- PostgreSQL Initialization Script for Skippy Trading Platform
-- Creates necessary extensions and optimizes settings

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create performance monitoring functions
CREATE OR REPLACE FUNCTION pg_stat_statements_reset() RETURNS void AS $$
BEGIN
  -- Reset query statistics
  PERFORM pg_stat_statements_reset();
END;
$$ LANGUAGE plpgsql;

-- Create session cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expire < NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres;
GRANT CREATE ON SCHEMA public TO postgres;

-- Log initialization
SELECT 'Skippy Trading Platform database initialized' as status;