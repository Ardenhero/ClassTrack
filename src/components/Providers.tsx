import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ProfileProvider } from "@/context/ProfileContext";
import { SWRConfig } from "swr";

export function Providers({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
    return (
        <NextThemesProvider {...props}>
            <SWRConfig value={{
                revalidateOnFocus: false,
                dedupingInterval: 120000,   // 2 minutes (Responsive Sync)
                refreshInterval: 1800000   // 30 min (Tuya Heartbeat baseline)
            }}>
                <ProfileProvider>
                    {children}
                </ProfileProvider>
            </SWRConfig>
        </NextThemesProvider>
    );
}
