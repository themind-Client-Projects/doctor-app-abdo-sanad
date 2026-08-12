import type { NextConfig } from "next";

/**
 * Response headers the browser enforces on our behalf.
 *
 * The app served none at all. For a platform holding medical files and a wallet
 * that is worth closing, and the concrete risk is clickjacking: the admin panel
 * has one-click destructive actions — retire a partner, change a role, settle
 * money — so an attacker who can frame a page and float a decoy over it can get
 * a signed-in admin to trigger them without ever seeing what they clicked.
 *
 * Deliberately NOT here: a `script-src` policy. Next.js injects inline
 * bootstrap scripts, so a real script CSP needs per-request nonces threaded
 * through the document, and a half-configured one either breaks the app or
 * lulls you with a policy that `unsafe-inline` has already defeated. That is
 * its own piece of work; `frame-ancestors` is the part that does not need it
 * and cannot be set from a meta tag.
 */
const securityHeaders = [
  // Clickjacking. `frame-ancestors` is the modern form and beats
  // X-Frame-Options; the latter stays for older browsers.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },

  // Stop the browser second-guessing a declared Content-Type — the trick that
  // turns an uploaded "image" into executable script.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // URLs here carry patient and order ids in the path. Without this the full
  // URL travels in the Referer header to any third-party asset or outbound
  // link, which quietly hands those ids to someone else's logs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Nothing in the app uses these; denying them means a compromised script
  // cannot silently reach for them either.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          // HSTS only in production: sending it from a local http:// dev server
          // is ignored by the browser today but would pin localhost to https
          // the moment anything serves it over TLS, breaking every other
          // project on the machine.
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
