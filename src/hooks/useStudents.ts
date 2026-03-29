import useSWR from 'swr';

interface Student {
    id: string;
    name: string;
    sin?: string;
    year_level: string;
    department?: string;
    instructor_id?: string;
    instructor_name?: string;
    instructor_image_url?: string | null;
    fingerprint_slot_id?: number | null;
    image_url?: string | null;
}

interface StudentsResponse {
    success: boolean;
    students: Student[];
    count: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useStudents(query?: string, initialData?: Student[]) {
    // Generate SWR key based on query
    const key = query ? `/api/students?query=${encodeURIComponent(query)}` : '/api/students';

    const { data, error, isLoading, mutate } = useSWR<StudentsResponse>(key, fetcher, {
        fallbackData: initialData ? { success: true, students: initialData, count: initialData.length } : undefined,
        revalidateOnFocus: false, // Don't revalidate on focus to save egress
        revalidateIfStale: false,  // Trust the cache more aggressively
        dedupingInterval: 60000,   // Wait 60s before allowing a redundant fetch
    });

    return {
        students: data?.students || [],
        isLoading,
        isError: error,
        mutate
    };
}
