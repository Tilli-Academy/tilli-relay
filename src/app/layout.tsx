import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Relay — API Development Tool",
  description: "A curl-first API development tool compatible with Postman collections",
  icons: {
    icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAEbElEQVR4nO1WXYhUZRh+3u+cMz+7O+vP7vqzaRahlVmkWBgEq2FdRUIy2U0g0Y0kXQSpEHlmJKLQizBcBCOp7mZDDZPIiN2lNTQpQqFEs1J23XWmnV3dnb8z5/ueLmbG1XVnd1azbnxuDpyf93me93u/53zAXfwHIKlIyv/DnqB1B6pO7cYlFVwqAGBh6PETvVeaAOC2OlH6eOoCbZ2dNgDUA9h6xtu07nhu5MCF4QcAwC2LmjaiiYQFAI4FkBfDVQVWXOeG7tvwU+5AUyfZdMTzTmezC29VgLS5JUfk2eC23ekv3tmT3AsA0ejY+lZc1wmw71Ju06qeYso+SuKQ9u/9xssfS6cXTSRgUjXll9kdX+N/+PmlJ9Zvm9vTc2bW+sFM0AKAZBJSti7da9b4ZGbBq6e9IzvOhdqPp+1mnYUvoixDSKgKh12NvM2lHY+LTyYCWz56dvtXPwa3pIaCTiAEbSvoynuVodp3fvT5p4857SfzzkJvxNeWUsqIsjiZw+oCKN1x8Q9+e/HRjTtmfHqut3F5JpuHZeULSuqClUEMv3jOElni96S8le3J+sO/DAIgfFGWrSEQYCr+m5fAdalIqNffTb6258vmnlN/Ni7PZbO+bfskMc7RYgDAACSSyoGi4YvQJmrfaTd0IBqlFY+LHm1MfnBqoGXL1aECHJXRxhKbtAAxExexqB1FIURNd5Pf0IHk0pL0831OQy4HY6ti0YiUJ716N40PmY7rqgLGbrKgFJSB3PH8nngbyi3aqQIhgPx0BPzLoIDDVZ7dUQECAARmOcZ+Zn64xBW7XQEEoGqbDQEIBbYG0QeE/gYosXHTPKEAw0nyQ4BM1ng1kMPQ6FAEsixi9onISFsnLBGZWgAElZAHrptHEUixaKA9/0GSViR9894UABZAEh4d5TwXzA/seiy7G6R0rR6L8EkFzGnxpMRevlwrLqpYyHO4EF7bP9i/pCMuHkCVL2hLAA3ANzRaE1I/A4F1c4oDe1daL4g0XyWA8e6rCpgVcX52bAjHpQsJCdjghf4A39gZ/uRoV3KxrcQsWxC64gdhOQ0ItM62rCdn+sObW037oZX+qtZA4KRLqonIKx27BtelisfFdP86Ov+9dvw2MOxEbOUJMZaw5bWl2PUyu24k2xzhidZFLMpTocgw7O/WzrX/enkevhGRXqB0NItLlQwfLwAo/Q86OkRv3N6/9ezlee9nMrmCrUyA41ORNKRSWoUxtyGdPrpndotcT5SgxShMNecV3LQEHR2io9GEtT++d+dD96QORyLhoKdt0YY+AR9E6SqgNjo/swFY8XDxYxExbfsZcjtpu6TCS6KnIp+wA2V7pQwh1OZdqbf/6Kt/c7RQNyPnlWNVAdRAOAQsu//q9+1vqWgs1pCKxcBaSGsQUBFRKtY7OLjws6/tDb+fV0svp/ON2YxGS1Odt+IR88PWV/yDIs19JGW65DXh+oNnVam3cdav6UPXdRUQU/GuLmDO6msuo1EgUcOg3cVk+AfKeBBPHEf7AQAAAABJRU5ErkJggg==",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body className={`${inter.variable} ${jetbrains.variable} font-sans bg-surface-base text-content-primary antialiased`}>
        {children}
      </body>
    </html>
  );
}
