-- Enable RLS on tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (public) for Kiosk and Admin
CREATE POLICY "Allow public read access on departments"
ON departments FOR SELECT
TO public
USING (true);

-- Allow authenticated users (Admin) to insert/update/delete departments
CREATE POLICY "Allow authenticated full access on departments"
ON departments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to manage instructors
CREATE POLICY "Allow authenticated full access on instructors"
ON instructors FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow public read access on instructors (for Kiosk)
CREATE POLICY "Allow public read access on instructors"
ON instructors FOR SELECT
TO public
USING (true);
