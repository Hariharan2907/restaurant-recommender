import type { PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";
export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Find your next favorite restaurant with Fork. Discover places for your taste, mood, and occasion, with clear recommendations and real diner reviews."
        />
        <title>Fork — Find your next favorite</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
