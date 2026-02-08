import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ProfileProvider } from "@/context/ProfileContext";

export function Providers({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
    return (
        <NextThemesProvider {...props}>
            <ProfileProvider>
                {children}
            </ProfileProvider>
        </NextThemesProvider>
    );
}
