-- =================================================================
-- Academic Year & Term (Semester) Management
-- =================================================================

-- 1. Create Academic Years Table
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g., "2026-2027"
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Academic Terms (Semesters) Table
CREATE TABLE IF NOT EXISTS academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "1st Semester", "2nd Semester", "Summer"
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(academic_year_id, name)
);

-- 3. Add term_id to classes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'term_id') THEN
        ALTER TABLE classes ADD COLUMN term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Enhance students table for graduation/tracking
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'enrollment_status') THEN
        ALTER TABLE students ADD COLUMN enrollment_status TEXT DEFAULT 'active' CHECK (enrollment_status IN ('active', 'graduated', 'transferred', 'dropped'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'batch_year') THEN
        ALTER TABLE students ADD COLUMN batch_year TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'updated_at') THEN
        ALTER TABLE students ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 5. Enable RLS
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;

-- 6. Basic Policies (Anyone authenticated can view, only admins can manage)
DROP POLICY IF EXISTS "Anyone can view academic years" ON academic_years;
CREATE POLICY "Anyone can view academic years" ON academic_years FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage academic years" ON academic_years;
CREATE POLICY "Admins can manage academic years" ON academic_years FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND (role = 'admin' OR is_super_admin = true)));

DROP POLICY IF EXISTS "Anyone can view academic terms" ON academic_terms;
CREATE POLICY "Anyone can view academic terms" ON academic_terms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage academic terms" ON academic_terms;
CREATE POLICY "Admins can manage academic terms" ON academic_terms FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM instructors WHERE auth_user_id = auth.uid() AND (role = 'admin' OR is_super_admin = true)));
